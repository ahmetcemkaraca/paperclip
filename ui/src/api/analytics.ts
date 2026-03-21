import type {
  CompanyAnalyticsOverview,
  CostTrendPoint,
  AgentPerformanceMetrics,
  TaskVelocityMetrics,
  ActivityHeatmapPoint,
  ProjectProgressMetrics,
} from "@paperclipai/shared";
import { api } from "./client";

interface DateRangeParams {
  from?: string;
  to?: string;
  days?: number;
}

function buildDateRangeQuery(params?: DateRangeParams): string {
  if (!params) return "";
  const searchParams = new URLSearchParams();
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
  if (params.days) searchParams.set("days", String(params.days));
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export const analyticsApi = {
  getOverview: (companyId: string) =>
    api.get<CompanyAnalyticsOverview>(`/companies/${companyId}/analytics/overview`),

  getCostTrend: (companyId: string, params?: DateRangeParams) =>
    api.get<CostTrendPoint[]>(`/companies/${companyId}/analytics/costs/trend${buildDateRangeQuery(params)}`),

  getAgentPerformance: (companyId: string) =>
    api.get<AgentPerformanceMetrics[]>(`/companies/${companyId}/analytics/agents/performance`),

  getTaskVelocity: (companyId: string, params?: DateRangeParams) =>
    api.get<TaskVelocityMetrics>(`/companies/${companyId}/analytics/tasks/velocity${buildDateRangeQuery(params)}`),

  getActivityHeatmap: (companyId: string, params?: DateRangeParams) =>
    api.get<ActivityHeatmapPoint[]>(`/companies/${companyId}/analytics/activity/heatmap${buildDateRangeQuery(params)}`),

  getProjectProgress: (companyId: string) =>
    api.get<ProjectProgressMetrics[]>(`/companies/${companyId}/analytics/projects/progress`),
};