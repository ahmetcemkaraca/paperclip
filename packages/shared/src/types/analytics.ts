export interface CostTrendPoint {
  date: string;
  totalCents: number;
  byProvider: Record<string, number>;
  runCount: number;
}

export interface AgentPerformanceMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  agentStatus: string;
  runsTotal: number;
  runsSuccessful: number;
  runsFailed: number;
  avgRunDurationMs: number | null;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksBlocked: number;
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  errorRate: number;
  costPerTask: number | null;
}

export interface TaskVelocityMetrics {
  periodStart: string;
  periodEnd: string;
  created: number;
  completed: number;
  cancelled: number;
  avgTimeToCompletionMs: number | null;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface ActivityHeatmapPoint {
  hour: number;
  dayOfWeek: number;
  count: number;
}

export interface ProjectProgressMetrics {
  projectId: string;
  projectName: string;
  projectStatus: string;
  progressPercent: number;
  totalIssues: number;
  completedIssues: number;
  inProgressIssues: number;
  blockedIssues: number;
  leadAgentId: string | null;
  leadAgentName: string | null;
  targetDate: string | null;
  totalCostCents: number;
}

export interface CompanyAnalyticsOverview {
  costs: {
    totalCents: number;
    budgetCents: number;
    utilizationPercent: number;
    trendDirection: "up" | "down" | "stable";
    trendPercent: number;
  };
  agents: {
    total: number;
    active: number;
    running: number;
    paused: number;
    error: number;
    avgUtilizationPercent: number;
  };
  tasks: {
    total: number;
    open: number;
    inProgress: number;
    completed: number;
    blocked: number;
    avgCompletionTimeMs: number | null;
  };
  projects: {
    total: number;
    active: number;
    completed: number;
    avgProgressPercent: number;
  };
  budget: {
    activeIncidents: number;
    pausedAgents: number;
    pausedProjects: number;
  };
}