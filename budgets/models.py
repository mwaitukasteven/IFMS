from django.db import models


class Budget(models.Model):
    year = models.IntegerField()
    total_budget = models.DecimalField(max_digits=15, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    # When a budget is closed/approved, any unspent portion is released back
    # to available revenue. Committed-against-revenue then equals total_spent
    # rather than total_budget.
    is_closed = models.BooleanField(default=False)
    closed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return str(self.year)


class BudgetLine(models.Model):
    CATEGORY_CHOICES = (
        ('capex', 'CAPEX'),
        ('opex', 'OPEX'),
    )

    budget = models.ForeignKey(Budget, on_delete=models.CASCADE)

    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)

    description = models.CharField(max_length=255)

    # Points at the shared asset register — an expense line may be
    # attributed to a specific asset (usually a building) for capex tracking.
    linked_property = models.ForeignKey(
        'assets.Asset',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='budget_lines',
    )

    allocated_amount = models.DecimalField(max_digits=15, decimal_places=2)
    spent_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
