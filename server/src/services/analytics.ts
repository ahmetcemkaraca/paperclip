import { and, count, eq, gte, lte, sql, isNotNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  activityLog,
  agents,
  companies,
  costEvents,
  heartbeatRuns,
  issues,
  projects,
} from "@paperclipai/db";

export interface AnalyticsDateRange {
  from: Date;
  to: Date;
}

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

function getDefaultDateRange(days: number = 30): AnalyticsDateRange {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to };
}

export function analyticsService(db: Db) {
  return {
    getOverview: async (companyId: string): Promise<CompanyAnalyticsOverview> => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) {
        throw new Error("Company not found");
      }

      const { from } = getDefaultDateRange(30);
      const previousFrom = new Date(from.getTime() - 30 * 24 * 60 * 60 * 1000);

      const currentPeriodRows = await db
        .select({
          total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`.as("total"),
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, from)
          )
        );

      const previousPeriodRows = await db
        .select({
          total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`.as("total"),
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, previousFrom),
            lte(costEvents.occurredAt, from)
          )
        );

      const currentSpend = Number(currentPeriodRows[0]?.total ?? 0);
      const previousSpend = Number(previousPeriodRows[0]?.total ?? 0);
      const trendPercent = previousSpend > 0 ? ((currentSpend - previousSpend) / previousSpend) * 100 : 0;
      const trendDirection: "up" | "down" | "stable" =
        trendPercent > 5 ? "up" : trendPercent < -5 ? "down" : "stable";

      const agentStatsRows = await db
        .select({
          total: sql<number>`count(*)::int`.as("total"),
          active: sql<number>`count(*) filter (where ${agents.status} in ('active', 'idle'))::int`.as("active"),
          running: sql<number>`count(*) filter (where ${agents.status} = 'running')::int`.as("running"),
          paused: sql<number>`count(*) filter (where ${agents.status} = 'paused')::int`.as("paused"),
          error: sql<number>`count(*) filter (where ${agents.status} = 'error')::int`.as("error"),
        })
        .from(agents)
        .where(eq(agents.companyId, companyId));

      const taskStatsRows = await db
        .select({
          total: sql<number>`count(*)::int`.as("total"),
          open: sql<number>`count(*) filter (where ${issues.status} in ('backlog', 'todo', 'in_progress', 'in_review'))::int`.as("open"),
          inProgress: sql<number>`count(*) filter (where ${issues.status} = 'in_progress')::int`.as("inProgress"),
          completed: sql<number>`count(*) filter (where ${issues.status} = 'done')::int`.as("completed"),
          blocked: sql<number>`count(*) filter (where ${issues.status} = 'blocked')::int`.as("blocked"),
          avgCompletionTime: sql<number | null>`avg(extract(epoch from (${issues.completedAt} - ${issues.startedAt})) * 1000) filter (where ${issues.status} = 'done' and ${issues.startedAt} is not null and ${issues.completedAt} is not null)`.as("avgCompletionTime"),
        })
        .from(issues)
        .where(eq(issues.companyId, companyId));

      const projectStatsRows = await db
        .select({
          total: sql<number>`count(*)::int`.as("total"),
          active: sql<number>`count(*) filter (where ${projects.status} = 'in_progress')::int`.as("active"),
          completed: sql<number>`count(*) filter (where ${projects.status} = 'completed')::int`.as("completed"),
          avgProgress: sql<number>`coalesce(avg(${projects.progressPercent}) filter (where ${projects.status} = 'in_progress'), 0)::float`.as("avgProgress"),
        })
        .from(projects)
        .where(eq(projects.companyId, companyId));

      const pausedProjectsRows = await db
        .select({
          count: sql<number>`count(*)::int`.as("count"),
        })
        .from(projects)
        .where(
          and(
            eq(projects.companyId, companyId),
            isNotNull(projects.pausedAt)
          )
        );

      const agentStats = agentStatsRows[0];
      const taskStats = taskStatsRows[0];
      const projectStats = projectStatsRows[0];
      const pausedAgentsCount = Number(agentStats?.paused ?? 0);
      const pausedProjectsCount = Number(pausedProjectsRows[0]?.count ?? 0);

      return {
        costs: {
          totalCents: currentSpend,
          budgetCents: company.budgetMonthlyCents,
          utilizationPercent: company.budgetMonthlyCents > 0 ? (currentSpend / company.budgetMonthlyCents) * 100 : 0,
          trendDirection,
          trendPercent: Math.abs(trendPercent),
        },
        agents: {
          total: Number(agentStats?.total ?? 0),
          active: Number(agentStats?.active ?? 0),
          running: Number(agentStats?.running ?? 0),
          paused: pausedAgentsCount,
          error: Number(agentStats?.error ?? 0),
          avgUtilizationPercent: 0,
        },
        tasks: {
          total: Number(taskStats?.total ?? 0),
          open: Number(taskStats?.open ?? 0),
          inProgress: Number(taskStats?.inProgress ?? 0),
          completed: Number(taskStats?.completed ?? 0),
          blocked: Number(taskStats?.blocked ?? 0),
          avgCompletionTimeMs: taskStats?.avgCompletionTime ?? null,
        },
        projects: {
          total: Number(projectStats?.total ?? 0),
          active: Number(projectStats?.active ?? 0),
          completed: Number(projectStats?.completed ?? 0),
          avgProgressPercent: Number(projectStats?.avgProgress ?? 0),
        },
        budget: {
          activeIncidents: 0,
          pausedAgents: pausedAgentsCount,
          pausedProjects: pausedProjectsCount,
        },
      };
    },

    getCostTrend: async (companyId: string, range?: AnalyticsDateRange): Promise<CostTrendPoint[]> => {
      const { from, to } = range ?? getDefaultDateRange(30);

      const rows = await db
        .select({
          date: sql<string>`date_trunc('day', ${costEvents.occurredAt})::date::text`.as("date"),
          totalCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`.as("totalCents"),
          provider: costEvents.provider,
          runCount: sql<number>`count(distinct ${costEvents.heartbeatRunId})::int`.as("runCount"),
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, from),
            lte(costEvents.occurredAt, to)
          )
        )
        .groupBy(sql`date_trunc('day', ${costEvents.occurredAt})::date`, costEvents.provider);

      const dateMap = new Map<string, CostTrendPoint>();

      for (const row of rows) {
        const dateStr = String(row.date);
        if (!dateMap.has(dateStr)) {
          dateMap.set(dateStr, {
            date: dateStr,
            totalCents: 0,
            byProvider: {},
            runCount: 0,
          });
        }
        const point = dateMap.get(dateStr)!;
        point.totalCents += Number(row.totalCents);
        point.runCount += Number(row.runCount);
        if (row.provider) {
          point.byProvider[row.provider] = (point.byProvider[row.provider] ?? 0) + Number(row.totalCents);
        }
      }

      return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    },

    getAgentPerformance: async (companyId: string): Promise<AgentPerformanceMetrics[]> => {
      const agentList = await db
        .select({
          id: agents.id,
          name: agents.name,
          role: agents.role,
          status: agents.status,
        })
        .from(agents)
        .where(eq(agents.companyId, companyId));

      const results: AgentPerformanceMetrics[] = [];

      for (const agent of agentList) {
        const runStatsRows = await db
          .select({
            total: sql<number>`count(*)::int`.as("total"),
            successful: sql<number>`count(*) filter (where ${heartbeatRuns.status} = 'success')::int`.as("successful"),
            failed: sql<number>`count(*) filter (where ${heartbeatRuns.status} = 'error')::int`.as("failed"),
            avgDuration: sql<number | null>`avg(extract(epoch from (${heartbeatRuns.finishedAt} - ${heartbeatRuns.startedAt})) * 1000) filter (where ${heartbeatRuns.finishedAt} is not null and ${heartbeatRuns.startedAt} is not null)`.as("avgDuration"),
          })
          .from(heartbeatRuns)
          .where(eq(heartbeatRuns.agentId, agent.id));

        const taskStatsRows = await db
          .select({
            completed: sql<number>`count(*) filter (where ${issues.status} = 'done')::int`.as("completed"),
            inProgress: sql<number>`count(*) filter (where ${issues.status} = 'in_progress')::int`.as("inProgress"),
            blocked: sql<number>`count(*) filter (where ${issues.status} = 'blocked')::int`.as("blocked"),
          })
          .from(issues)
          .where(eq(issues.assigneeAgentId, agent.id));

        const costStatsRows = await db
          .select({
            totalCost: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`.as("totalCost"),
            inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`.as("inputTokens"),
            outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`.as("outputTokens"),
          })
          .from(costEvents)
          .where(eq(costEvents.agentId, agent.id));

        const runStats = runStatsRows[0];
        const taskStats = taskStatsRows[0];
        const costStats = costStatsRows[0];

        const runsTotal = Number(runStats?.total ?? 0);
        const runsFailed = Number(runStats?.failed ?? 0);
        const tasksCompleted = Number(taskStats?.completed ?? 0);
        const totalCost = Number(costStats?.totalCost ?? 0);

        results.push({
          agentId: agent.id,
          agentName: agent.name,
          agentRole: agent.role,
          agentStatus: agent.status,
          runsTotal,
          runsSuccessful: Number(runStats?.successful ?? 0),
          runsFailed,
          avgRunDurationMs: runStats?.avgDuration ?? null,
          tasksCompleted,
          tasksInProgress: Number(taskStats?.inProgress ?? 0),
          tasksBlocked: Number(taskStats?.blocked ?? 0),
          totalCostCents: totalCost,
          totalInputTokens: Number(costStats?.inputTokens ?? 0),
          totalOutputTokens: Number(costStats?.outputTokens ?? 0),
          errorRate: runsTotal > 0 ? (runsFailed / runsTotal) * 100 : 0,
          costPerTask: tasksCompleted > 0 ? totalCost / tasksCompleted : null,
        });
      }

      return results.sort((a, b) => b.totalCostCents - a.totalCostCents);
    },

    getTaskVelocity: async (companyId: string, range?: AnalyticsDateRange): Promise<TaskVelocityMetrics> => {
      const { from, to } = range ?? getDefaultDateRange(30);

      const createdRows = await db
        .select({ count: sql<number>`count(*)::int`.as("count") })
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            gte(issues.createdAt, from),
            lte(issues.createdAt, to)
          )
        );

      const completedRows = await db
        .select({
          count: sql<number>`count(*)::int`.as("count"),
          avgTime: sql<number | null>`avg(extract(epoch from (${issues.completedAt} - ${issues.startedAt})) * 1000) filter (where ${issues.startedAt} is not null)`.as("avgTime"),
        })
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            eq(issues.status, "done"),
            gte(issues.completedAt, from),
            lte(issues.completedAt, to)
          )
        );

      const cancelledRows = await db
        .select({ count: sql<number>`count(*)::int`.as("count") })
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            eq(issues.status, "cancelled"),
            gte(issues.cancelledAt, from),
            lte(issues.cancelledAt, to)
          )
        );

      const byPriorityRows = await db
        .select({
          priority: issues.priority,
          count: sql<number>`count(*)::int`.as("count"),
        })
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            gte(issues.createdAt, from),
            lte(issues.createdAt, to)
          )
        )
        .groupBy(issues.priority);

      const byStatusRows = await db
        .select({
          status: issues.status,
          count: sql<number>`count(*)::int`.as("count"),
        })
        .from(issues)
        .where(eq(issues.companyId, companyId))
        .groupBy(issues.status);

      const byPriority: Record<string, number> = {};
      for (const row of byPriorityRows) {
        if (row.priority) {
          byPriority[row.priority] = Number(row.count);
        }
      }

      const byStatus: Record<string, number> = {};
      for (const row of byStatusRows) {
        byStatus[row.status] = Number(row.count);
      }

      return {
        periodStart: from.toISOString(),
        periodEnd: to.toISOString(),
        created: Number(createdRows[0]?.count ?? 0),
        completed: Number(completedRows[0]?.count ?? 0),
        cancelled: Number(cancelledRows[0]?.count ?? 0),
        avgTimeToCompletionMs: completedRows[0]?.avgTime ?? null,
        byPriority,
        byStatus,
      };
    },

    getActivityHeatmap: async (companyId: string, range?: AnalyticsDateRange): Promise<ActivityHeatmapPoint[]> => {
      const { from, to } = range ?? getDefaultDateRange(30);

      const rows = await db
        .select({
          hour: sql<number>`extract(hour from ${activityLog.createdAt})::int`.as("hour"),
          dayOfWeek: sql<number>`extract(dow from ${activityLog.createdAt})::int`.as("dayOfWeek"),
          count: sql<number>`count(*)::int`.as("count"),
        })
        .from(activityLog)
        .where(
          and(
            eq(activityLog.companyId, companyId),
            gte(activityLog.createdAt, from),
            lte(activityLog.createdAt, to)
          )
        )
        .groupBy(
          sql`extract(hour from ${activityLog.createdAt})::int`,
          sql`extract(dow from ${activityLog.createdAt})::int`
        );

      return rows.map((row) => ({
        hour: Number(row.hour),
        dayOfWeek: Number(row.dayOfWeek),
        count: Number(row.count),
      }));
    },

    getProjectProgress: async (companyId: string): Promise<ProjectProgressMetrics[]> => {
      const projectList = await db
        .select({
          id: projects.id,
          name: projects.name,
          status: projects.status,
          progressPercent: projects.progressPercent,
          leadAgentId: projects.leadAgentId,
          targetDate: projects.targetDate,
        })
        .from(projects)
        .where(eq(projects.companyId, companyId));

      const results: ProjectProgressMetrics[] = [];

      for (const project of projectList) {
        const issueStatsRows = await db
          .select({
            total: sql<number>`count(*)::int`.as("total"),
            completed: sql<number>`count(*) filter (where ${issues.status} = 'done')::int`.as("completed"),
            inProgress: sql<number>`count(*) filter (where ${issues.status} = 'in_progress')::int`.as("inProgress"),
            blocked: sql<number>`count(*) filter (where ${issues.status} = 'blocked')::int`.as("blocked"),
          })
          .from(issues)
          .where(eq(issues.projectId, project.id));

        const costStatsRows = await db
          .select({
            total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`.as("total"),
          })
          .from(costEvents)
          .innerJoin(issues, eq(costEvents.issueId, issues.id))
          .where(eq(issues.projectId, project.id));

        const issueStats = issueStatsRows[0];
        const costStats = costStatsRows[0];

        let leadAgentName: string | null = null;
        if (project.leadAgentId) {
          const agentRows = await db
            .select({ name: agents.name })
            .from(agents)
            .where(eq(agents.id, project.leadAgentId));
          leadAgentName = agentRows[0]?.name ?? null;
        }

        results.push({
          projectId: project.id,
          projectName: project.name,
          projectStatus: project.status,
          progressPercent: project.progressPercent ?? 0,
          totalIssues: Number(issueStats?.total ?? 0),
          completedIssues: Number(issueStats?.completed ?? 0),
          inProgressIssues: Number(issueStats?.inProgress ?? 0),
          blockedIssues: Number(issueStats?.blocked ?? 0),
          leadAgentId: project.leadAgentId ?? null,
          leadAgentName,
          targetDate: project.targetDate ?? null,
          totalCostCents: Number(costStats?.total ?? 0),
        });
      }

      return results.sort((a, b) => b.progressPercent - a.progressPercent);
    },
  };
}