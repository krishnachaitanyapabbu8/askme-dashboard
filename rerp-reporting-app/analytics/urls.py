from django.urls import path

from analytics.views import DailyDataExportView, DashboardDataView

urlpatterns = [
    path("daily-chat-history", DailyDataExportView.as_view()),
    path("dashboard-data", DashboardDataView.as_view()),
]
