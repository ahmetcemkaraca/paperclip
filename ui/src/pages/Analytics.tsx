import { useQuery } from "@tanstack/react-query";
import type {
  AgentPerformanceMetrics,
  ProjectProgressMetrics,
} from "@paperclipai/shared";
import {
  Activity as ActivityIcon,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  DollarSign,
  Minus,
  TrendingUp,
  Users,
} from "lucide-react";
import { analyticsApi } from "../api/analytics";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { StatusBadge } from "../components/StatusBadge";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { cn, formatCents, formatDuration } from "../lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendDirection,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: number;
  trendDirection?: "up" | "down" | "stable";
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="rounded-lg bg-muted p-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        {trend !== undefined && trendDirection && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            {trendDirection === "up" && <ArrowUpRight className="h-3 w-3 text-red-500" />}
            {trendDirection === "down" && <ArrowDownRight className="h-3 w-3 text-green-500" />}
            {trendDirection === "stable" && <Minus className="h-3 w-3 text-muted-foreground" />}
            <span className={cn(
              trendDirection === "up" && "text-red-500",
              trendDirection === "down" && "text-green-500",
              trendDirection === "stable" && "text-muted-foreground",
            )}>
              {trend.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">vs last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AgentPerformanceRow({ agent }: { agent: AgentPerformanceMetrics }) {
  const errorRateClass = agent.errorRate > 20 ? "text-red-500" : agent.errorRate > 10 ? "text-yellow-500" : "text-green-500";

  return (
    <tr className="border-b border-border">
      <td className="py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{agent.agentName}</span>
          <StatusBadge status={agent.agentStatus} />
        </div>
      </td>
      <td className="py-3 text-sm text-muted-foreground">{agent.agentRole}</td>
      <td className="py-3 text-right font-mono text-sm tabular-nums">{agent.runsTotal}</td>
      <td className="py-3 text-right font-mono text-sm tabular-nums">
        <span className={errorRateClass}>{agent.errorRate.toFixed(1)}%</span>
      </td>
      <td className="py-3 text-right font-mono text-sm tabular-nums">{agent.tasksCompleted}</td>
      <td className="py-3 text-right font-mono text-sm tabular-nums">{formatCents(agent.totalCostCents)}</td>
      <td className="py-3 text-right font-mono text-sm tabular-nums">
        {agent.costPerTask ? formatCents(agent.costPerTask) : "-"}
      </td>
    </tr>
  );
}

function ProjectProgressRow({ project }: { project: ProjectProgressMetrics }) {
  return (
    <tr className="border-b border-border">
      <td className="py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{project.projectName}</span>
          <StatusBadge status={project.projectStatus} />
        </div>
      </td>
      <td className="py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full" 
              style={{ width: `${project.progressPercent}%` }} 
            />
          </div>
          <span className="text-sm tabular-nums">{project.progressPercent}%</span>
        </div>
      </td>
      <td className="py-3 text-center text-sm tabular-nums">{project.completedIssues}/{project.totalIssues}</td>
      <td className="py-3 text-center text-sm tabular-nums">{project.inProgressIssues}</td>
      <td className="py-3 text-center text-sm tabular-nums">{project.blockedIssues}</td>
      <td className="py-3 text-sm text-muted-foreground">{project.leadAgentName || "-"}</td>
      <td className="py-3 text-right font-mono text-sm tabular-nums">{formatCents(project.totalCostCents)}</td>
    </tr>
  );
}

export function Analytics() {
  const { selectedCompanyId } = useCompany();

  const overviewQuery = useQuery({
    queryKey: queryKeys.analytics.overview(selectedCompanyId ?? ""),
    queryFn: () => analyticsApi.getOverview(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentPerformanceQuery = useQuery({
    queryKey: queryKeys.analytics.agentPerformance(selectedCompanyId ?? ""),
    queryFn: () => analyticsApi.getAgentPerformance(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const projectProgressQuery = useQuery({
    queryKey: queryKeys.analytics.projectProgress(selectedCompanyId ?? ""),
    queryFn: () => analyticsApi.getProjectProgress(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (overviewQuery.isLoading || agentPerformanceQuery.isLoading || projectProgressQuery.isLoading) {
    return <PageSkeleton />;
  }

  if (overviewQuery.isError) {
    return (
      <div className="p-6">
        <EmptyState
          icon={BarChart3}
          message={overviewQuery.error instanceof Error ? overviewQuery.error.message : "Failed to load analytics"}
        />
      </div>
    );
  }

  const overview = overviewQuery.data;
  const agents = agentPerformanceQuery.data ?? [];
  const projects = projectProgressQuery.data ?? [];

  if (!overview) return null;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Company performance overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Monthly Spend"
          value={formatCents(overview.costs.totalCents)}
          subtitle={overview.costs.budgetCents > 0 ? `${((overview.costs.utilizationPercent)).toFixed(0)}% of budget` : undefined}
          icon={DollarSign}
          trend={overview.costs.trendPercent}
          trendDirection={overview.costs.trendDirection}
        />
        <MetricCard
          title="Active Agents"
          value={overview.agents.active}
          subtitle={`${overview.agents.running} running, ${overview.agents.paused} paused`}
          icon={Users}
        />
        <MetricCard
          title="Open Tasks"
          value={overview.tasks.open}
          subtitle={`${overview.tasks.inProgress} in progress, ${overview.tasks.blocked} blocked`}
          icon={ActivityIcon}
        />
        <MetricCard
          title="Active Projects"
          value={overview.projects.active}
          subtitle={`${overview.projects.completed} completed`}
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Agent Performance
            </CardTitle>
            <CardDescription>Performance metrics by agent</CardDescription>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <EmptyState
                icon={Users}
                message="No agents yet. Create agents to see performance metrics."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Agent</th>
                      <th className="pb-2 font-medium">Role</th>
                      <th className="pb-2 text-right font-medium">Runs</th>
                      <th className="pb-2 text-right font-medium">Error Rate</th>
                      <th className="pb-2 text-right font-medium">Tasks Done</th>
                      <th className="pb-2 text-right font-medium">Total Cost</th>
                      <th className="pb-2 text-right font-medium">Cost/Task</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.slice(0, 10).map((agent) => (
                      <AgentPerformanceRow key={agent.agentId} agent={agent} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Project Progress
            </CardTitle>
            <CardDescription>Project completion status</CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                message="No projects yet. Create projects to track progress."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Project</th>
                      <th className="pb-2 font-medium">Progress</th>
                      <th className="pb-2 text-center font-medium">Done/Total</th>
                      <th className="pb-2 text-center font-medium">In Progress</th>
                      <th className="pb-2 text-center font-medium">Blocked</th>
                      <th className="pb-2 font-medium">Lead</th>
                      <th className="pb-2 text-right font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.slice(0, 10).map((project) => (
                      <ProjectProgressRow key={project.projectId} project={project} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Budget Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active Incidents</span>
                <span className={cn("font-medium", overview.budget.activeIncidents > 0 && "text-red-500")}>
                  {overview.budget.activeIncidents}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Paused Agents</span>
                <span className="font-medium">{overview.budget.pausedAgents}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Paused Projects</span>
                <span className="font-medium">{overview.budget.pausedProjects}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Task Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Tasks</span>
                <span className="font-medium">{overview.tasks.total}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-medium text-green-600">{overview.tasks.completed}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Avg Completion Time</span>
                <span className="font-medium">
                  {overview.tasks.avgCompletionTimeMs
                    ? formatDuration(overview.tasks.avgCompletionTimeMs)
                    : "-"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Agent Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Agents</span>
                <span className="font-medium">{overview.agents.total}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Running</span>
                <span className="font-medium text-blue-600">{overview.agents.running}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Errors</span>
                <span className={cn("font-medium", overview.agents.error > 0 && "text-red-500")}>
                  {overview.agents.error}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}