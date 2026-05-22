from django.urls import path

from .views import ActivityView, AssetsView, FindingsView, MetricsView, SummaryView


urlpatterns = [
    path("findings/", FindingsView.as_view(), name="findings"),
    path("summary/", SummaryView.as_view(), name="summary"),
    path("metrics/", MetricsView.as_view(), name="metrics"),
    path("assets/", AssetsView.as_view(), name="assets"),
    path("activity/", ActivityView.as_view(), name="activity"),
]
