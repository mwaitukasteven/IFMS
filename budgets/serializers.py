from decimal import Decimal
from datetime import date

from django.db.models import Sum
from rest_framework import serializers

from .models import Budget, BudgetLine
from .services import get_revenue_for_year


def committed_against_revenue(exclude_pk=None):
    """
    Sum of what each budget effectively locks away from available revenue.

    - Open budget: full `total_budget` is committed (money reserved, may still
      be spent).
    - Closed budget: only `total_spent` is committed; the unspent remainder
      has been released back to available revenue.
    """
    qs = Budget.objects.all()
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)
    total = Decimal('0')
    for b in qs.prefetch_related('budgetline_set'):
        if b.is_closed:
            spent = sum(
                (l.spent_amount for l in b.budgetline_set.all()),
                Decimal('0'),
            )
            total += spent
        else:
            total += b.total_budget
    return total


# Reasonable range for a budget year. We accept the current fiscal year and
# up to 20 years ahead (long-range capital planning), plus a small look-back
# window for backfilling historical records. Anything outside this window
# almost certainly comes from a typo (e.g. 202 instead of 2025).
YEAR_MIN_OFFSET = 10   # earliest allowed = current year - 10
YEAR_MAX_OFFSET = 20   # latest allowed   = current year + 20


class BudgetLineSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(
        source='linked_property.name',
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = BudgetLine
        fields = '__all__'

    def validate(self, attrs):
        budget = attrs.get('budget') or getattr(self.instance, 'budget', None)
        allocated = attrs.get('allocated_amount', getattr(self.instance, 'allocated_amount', None))

        if budget and allocated is not None:
            existing = BudgetLine.objects.filter(budget=budget)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            current_total = sum(line.allocated_amount for line in existing)
            if current_total + allocated > budget.total_budget:
                raise serializers.ValidationError(
                    f'Total allocated ({current_total + allocated}) exceeds budget cap '
                    f'({budget.total_budget}).'
                )
        return attrs


class BudgetSerializer(serializers.ModelSerializer):
    lines = BudgetLineSerializer(source='budgetline_set', many=True, read_only=True)
    total_allocated = serializers.SerializerMethodField()
    total_spent = serializers.SerializerMethodField()
    revenue_available = serializers.SerializerMethodField()
    remaining_budget = serializers.SerializerMethodField()
    opex_allocated = serializers.SerializerMethodField()
    capex_allocated = serializers.SerializerMethodField()

    class Meta:
        model = Budget
        fields = [
            'id', 'year', 'total_budget', 'created_at',
            'is_closed', 'closed_at',
            'lines', 'total_allocated', 'total_spent',
            'revenue_available', 'remaining_budget',
            'opex_allocated', 'capex_allocated',
        ]

    def get_total_allocated(self, obj):
        return sum(line.allocated_amount for line in obj.budgetline_set.all())

    def get_total_spent(self, obj):
        return sum(line.spent_amount for line in obj.budgetline_set.all())

    def get_revenue_available(self, obj):
        # Budget planning is now driven by total collected revenue (all-time),
        # not by revenue collected in the plan year.
        return get_revenue_for_year(None)

    def get_remaining_budget(self, obj):
        allocated = sum(line.allocated_amount for line in obj.budgetline_set.all())
        return obj.total_budget - allocated

    def get_opex_allocated(self, obj):
        return sum(
            line.allocated_amount for line in obj.budgetline_set.all() if line.category == 'opex'
        )

    def get_capex_allocated(self, obj):
        return sum(
            line.allocated_amount for line in obj.budgetline_set.all() if line.category == 'capex'
        )


class BudgetWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Budget
        fields = ['id', 'year', 'total_budget', 'created_at']

    def validate_year(self, value):
        try:
            year = int(value)
        except (TypeError, ValueError):
            raise serializers.ValidationError('Enter a valid year.')

        current_year = date.today().year
        min_year = current_year - YEAR_MIN_OFFSET
        max_year = current_year + YEAR_MAX_OFFSET
        if year < min_year or year > max_year:
            raise serializers.ValidationError(
                f'Year must be between {min_year} and {max_year}.'
            )

        # Uniqueness: one budget plan per year. On update we still allow the
        # same year (that's the existing record) but block collisions with a
        # different record.
        qs = Budget.objects.filter(year=year)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                f'A budget plan for {year} already exists. Choose a different year.'
            )
        return year

    def validate(self, attrs):
        year = attrs.get('year') or getattr(self.instance, 'year', None)
        total_budget = attrs.get('total_budget')

        if year and total_budget is not None:
            # Total revenue collected across ALL years (payments already
            # received). Budget planning is driven by cash on hand, not by
            # what a specific year's leases might yield.
            revenue = get_revenue_for_year(None)

            if revenue <= 0 and total_budget > 0:
                raise serializers.ValidationError(
                    {'total_budget': (
                        'No revenue has been collected yet. Record at least '
                        'one payment before planning any budget.'
                    )}
                )

            # Cap the plan by the leftover revenue after subtracting the
            # effective commitment of every other budget. Closed budgets only
            # commit what was actually spent — their unspent remainder has
            # been released back to the pool.
            exclude_pk = self.instance.pk if self.instance else None
            already_committed = committed_against_revenue(exclude_pk=exclude_pk)
            available_revenue = revenue - already_committed

            if total_budget > available_revenue:
                raise serializers.ValidationError(
                    {'total_budget': (
                        f'Budget ({total_budget}) exceeds available revenue '
                        f'({available_revenue}). Total collected revenue is '
                        f'{revenue}; {already_committed} is already committed '
                        f'to other budget plans.'
                    )}
                )
        return attrs
