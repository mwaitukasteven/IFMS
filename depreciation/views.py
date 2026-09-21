"""
DEPRECIATION APP — API Views

ViewSets for CRUD on DepreciationPolicy and DepreciationSchedule, plus
the core depreciation ENGINE (in the generate_schedule custom action).

Endpoints:
  GET    /api/depreciation/policies/                    → List policies
  POST   /api/depreciation/policies/                    → Create a policy
  GET    /api/depreciation/policies/<id>/               → Get one policy (with schedule)
  PUT    /api/depreciation/policies/<id>/               → Update a policy
  DELETE /api/depreciation/policies/<id>/               → Delete a policy
  POST   /api/depreciation/policies/<id>/generate_schedule/ → Run the engine
  GET    /api/depreciation/policies/stats/              → Dashboard stats

  GET    /api/depreciation/schedules/                   → List schedule rows
  POST   /api/depreciation/schedules/                   → Create a row manually
  GET    /api/depreciation/schedules/<id>/              → Get one row
  PUT    /api/depreciation/schedules/<id>/              → Update a row
  DELETE /api/depreciation/schedules/<id>/              → Delete a row
"""

from decimal import Decimal
from django.db.models import Sum, Count
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import DepreciationPolicy, DepreciationSchedule
from .serializers import (
    DepreciationPolicyListSerializer,
    DepreciationPolicyDetailSerializer,
    DepreciationScheduleSerializer,
)


# DEPRECIATION POLICY VIEWSET — full CRUD + engine + stats
class DepreciationPolicyViewSet(viewsets.ModelViewSet):
    """
    Provides standard CRUD endpoints for depreciation policies plus
    the generate_schedule custom action which runs the depreciation engine.
    """

    queryset = DepreciationPolicy.objects.all().select_related('asset', 'created_by')
    permission_classes = [IsAuthenticated]

    # Filtering, searching, ordering
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['asset__asset_code', 'asset__name', 'method', 'standard']
    ordering_fields = ['created_at', 'start_date', 'method']
    ordering = ['-created_at']

    def get_serializer_class(self):
        """Use the lightweight serializer for list, the detailed one for everything else."""
        if self.action == 'list':
            return DepreciationPolicyListSerializer
        return DepreciationPolicyDetailSerializer

    def perform_create(self, serializer):
        """Automatically set created_by to the logged-in user."""
        serializer.save(created_by=self.request.user)

    # Custom action: run the depreciation engine and generate all schedule rows
    @action(detail=True, methods=['post'])
    def generate_schedule(self, request, pk=None):
        """
        POST /api/depreciation/policies/<id>/generate_schedule/

        Runs the depreciation engine for this policy:
          - SLM: equal annual amount until NBV reaches residual value
          - DBM: percentage of opening NBV each year, last year tops up to residual
          - UPM: schedule rows are NOT auto-generated; the user must POST each
                 row manually with the actual units_used for the period

        Existing schedule rows for this policy are deleted first (so this
        action is safe to re-run after editing the policy).
        """
        policy = self.get_object()

        # UPM cannot be auto-generated because we don't know future unit usage.
        # The user must create schedule rows manually as units are consumed.
        if policy.method == DepreciationPolicy.METHOD_UPM:
            return Response({
                'error': (
                    'Units of Production schedules cannot be auto-generated. '
                    'Create schedule rows manually via POST /api/depreciation/schedules/ '
                    'with the units_used for each period.'
                )
            }, status=status.HTTP_400_BAD_REQUEST)

        # DBM requires a depreciation rate
        if policy.method == DepreciationPolicy.METHOD_DBM and not policy.depreciation_rate:
            return Response({
                'error': 'Declining Balance Method requires depreciation_rate to be set.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Wipe any existing rows so we generate a clean schedule
        policy.schedules.all().delete()

        # Pull values into local variables for readability
        cost = policy.asset.acquisition_cost
        residual = policy.residual_value
        # We round useful_life up to whole years for schedule generation —
        # fractional years would create a partial final-year row, which we
        # can support later if needed.
        useful_life = int(policy.useful_life_years)

        opening = cost
        accumulated = Decimal('0.00')
        periods_created = 0
        closing = opening

        # Generate one row per year until we hit useful_life OR NBV reaches residual
        for year in range(1, useful_life + 1):
            # Calculate this year's depreciation based on the chosen method
            if policy.method == DepreciationPolicy.METHOD_SLM:
                depreciation = policy.calculate_slm_annual()
            else:  # METHOD_DBM
                depreciation = policy.calculate_dbm_annual(opening)

            # Cap depreciation so closing NBV never drops below residual value
            # (this is what makes the final year's depreciation a "top-up")
            if opening - depreciation < residual:
                depreciation = opening - residual

            # Update running totals
            accumulated += depreciation
            closing = opening - depreciation

            # Create the schedule row
            DepreciationSchedule.objects.create(
                policy=policy,
                period_year=year,
                opening_nbv=opening,
                depreciation_amount=depreciation,
                accumulated_depreciation=accumulated,
                closing_nbv=closing,
            )
            periods_created += 1

            # Stop early if the asset is fully depreciated
            if closing <= residual:
                break

            # Roll forward — this year's closing is next year's opening
            opening = closing

        # Return summary of what was generated
        return Response({
            'message': f'Schedule generated successfully ({periods_created} periods).',
            'periods': periods_created,
            'method': policy.get_method_display(),
            'total_depreciation': accumulated,
            'final_nbv': closing,
        }, status=status.HTTP_200_OK)

    # Custom action: dashboard statistics for depreciation
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        GET /api/depreciation/policies/stats/

        Returns aggregate statistics for the depreciation dashboard:
          - total policies, by status
          - breakdown by depreciation method
          - total depreciation expense recognized to date (across all assets)
        """
        total_policies = DepreciationPolicy.objects.count()
        active_policies = DepreciationPolicy.objects.filter(
            status=DepreciationPolicy.STATUS_ACTIVE
        ).count()
        closed_policies = DepreciationPolicy.objects.filter(
            status=DepreciationPolicy.STATUS_CLOSED
        ).count()

        # Group policies by method (SLM/DBM/UPM)
        by_method = list(
            DepreciationPolicy.objects.values('method')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        # Total depreciation expense ever recognized (sum of every schedule row)
        total_depreciation = DepreciationSchedule.objects.aggregate(
            total=Sum('depreciation_amount')
        )['total'] or 0

        return Response({
            'total_policies': total_policies,
            'active_policies': active_policies,
            'closed_policies': closed_policies,
            'by_method': by_method,
            'total_depreciation_recognized': total_depreciation,
        })


# DEPRECIATION SCHEDULE VIEWSET — CRUD on individual rows
class DepreciationScheduleViewSet(viewsets.ModelViewSet):
    """
    Standard CRUD on schedule rows.

    Mostly used for:
      - Reading the schedule (the generate action creates rows automatically)
      - Manually adding rows for UPM policies (where each period's units_used
        must be entered by hand)
      - Adjusting individual rows after a revaluation or impairment event
    """

    queryset = DepreciationSchedule.objects.all().select_related('policy', 'policy__asset')
    serializer_class = DepreciationScheduleSerializer
    permission_classes = [IsAuthenticated]

    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['policy__asset__asset_code', 'policy__asset__name']
    ordering_fields = ['period_year', 'created_at']
    ordering = ['policy', 'period_year']
