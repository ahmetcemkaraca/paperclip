import type {
  CompanyAnalyticsOverview,
  CostTrendPoint,
  AgentPerformanceMetrics,
  TaskVelocityMetrics,
  ActivityHeatmapPoint,
  ProjectProgressMetrics,
} from "@paperclipai/shared";
import { api } from "./client";

export const analyticsApi = {
  getOverview: (companyId: string) =>
    api.get<CompanyAnalyticsOverview>(`/companies/${companyId}/analytics/overview`),

  getCostTrend: (companyId: string, params?: { from?: string; to?: string; days?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.from) searchParams.set("from", params.from);
    if (params?.to) searchParams.set("to", params.to);
    if (params?.days) searchParams.set("days", String(params.days));
    const query = searchParams.toString();
    return api.get<CostTrendPoint[]>(`/companies/${companyId}/analytics/costs/trend${query ? `?${query}` : ""}`);
  },

  getAgentPerformance: (companyId: string) =>
    api.get<AgentPerformanceMetrics[]>(`/companies/${companyId}/analytics/agents/performance`),

  getTaskVelocity: (companyId: string, params?: { from?: string; to?: string; days?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.from) searchParams.set("from", params.from);
    if (params?.to) searchParams.set("to", params.to);
    if (params?.days) searchParams.set("days", String(params.days));
    const query = searchParams.toString();
    return api.get<TaskVelocityMetrics>(`/companies/${companyId}/analytics/tasks/velocity${query ? `?${query}` : ""}`);
  },

  getActivityHeatmap: (companyId: string, params?: { from?: string; to?: string; days?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.from) searchParams.set("from", params.from);
    if (params?.to) searchParams.set("to", params.to);
    if (params?.days) searchParams.set("days", String(params.days));
    const query = searchParams.toString();
    return api.get<ActivityHeatmapPoint[]>(`/companies/${companyId}/analytics/activity/heatmap${query ? `?${query}` : ""}`);
  },

  getProjectProgress: (companyId: string) =>
    api.get<ProjectProgressMetrics[]>(`/companies/${companyId}/analytics/projects/progress`),
};