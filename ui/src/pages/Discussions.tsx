import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { discussionsApi } from "../api/discussions";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Plus } from "lucide-react";
import { PageSkeleton } from "../components/PageSkeleton";
import { Link } from "@/lib/router";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Identity } from "../components/Identity";
import { formatDateTime } from "../lib/utils";
import { MarkdownBody } from "../components/MarkdownBody";
import type { Agent } from "@paperclipai/shared";

interface Discussion {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  authorAgentId: string | null;
  authorUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DiscussionComment {
  id: string;
  companyId: string;
  discussionId: string;
  authorAgentId: string | null;
  authorUserId: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export function DiscussionsList() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [newDiscussionOpen, setNewDiscussionOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Forum" }]);
  }, [setBreadcrumbs]);

  const { data: discussions, isLoading } = useQuery({
    queryKey: queryKeys.discussions.list(selectedCompanyId!),
    queryFn: () => discussionsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; description?: string }) =>
      discussionsApi.create(selectedCompanyId!, data),
    onSuccess: (discussion) => {
      setError(null);
      setTitle("");
      setDescription("");
      setNewDiscussionOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.discussions.list(selectedCompanyId!) });
      navigate(`/${selectedCompany?.issuePrefix}/discussions/${discussion.id}`);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to create discussion");
    },
  });

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    await createMutation.mutateAsync({ title, description });
  };

  if (!selectedCompanyId) {
    return <p className="text-sm text-muted-foreground">Select a company first.</p>;
  }

  const agentMap = new Map((agents ?? []).map((a) => [a.id, a]));
  const sorted = [...(discussions ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Forum</h1>
        </div>
        <Dialog open={newDiscussionOpen} onOpenChange={setNewDiscussionOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Discussion
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start a New Discussion</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Input
                placeholder="Discussion title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={createMutation.isPending}
              />
              <Textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={createMutation.isPending}
                className="resize-none"
                rows={4}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setNewDiscussionOpen(false)}
                  disabled={createMutation.isPending}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : sorted.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">No discussions yet. Start one!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((discussion) => (
            <Link
              key={discussion.id}
              to={`/${selectedCompany?.issuePrefix}/discussions/${discussion.id}`}
              className="block border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="space-y-2">
                <h3 className="font-medium hover:underline">{discussion.title}</h3>
                {discussion.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{discussion.description}</p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {discussion.authorAgentId ? (
                      <span>{agentMap.get(discussion.authorAgentId)?.name ?? "Unknown"}</span>
                    ) : (
                      <span>Board</span>
                    )}
                  </div>
                  <span>{formatDateTime(discussion.createdAt)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function DiscussionDetail() {
  const { discussionId } = useParams<{ discussionId: string }>();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: discussion } = useQuery({
    queryKey: queryKeys.discussions.detail(discussionId!),
    queryFn: () => discussionsApi.get(discussionId!),
    enabled: !!discussionId,
  });

  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: queryKeys.discussions.comments(discussionId!),
    queryFn: () => discussionsApi.listComments(discussionId!),
    enabled: !!discussionId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const addCommentMutation = useMutation({
    mutationFn: (body: string) => discussionsApi.addComment(discussionId!, body),
    onSuccess: () => {
      setError(null);
      setComment("");
      queryClient.invalidateQueries({ queryKey: queryKeys.discussions.comments(discussionId!) });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to add comment");
    },
  });

  const handleAddComment = async () => {
    if (!comment.trim()) {
      setError("Comment cannot be empty");
      return;
    }
    await addCommentMutation.mutateAsync(comment);
  };

  useEffect(() => {
    if (discussion) {
      setBreadcrumbs([
        { label: "Forum", href: `/${selectedCompany?.issuePrefix}/discussions` },
        { label: discussion.title },
      ]);
    }
  }, [discussion, setBreadcrumbs, selectedCompany]);

  if (!discussion) {
    return <PageSkeleton />;
  }

  const agentMap = new Map((agents ?? []).map((a) => [a.id, a]));

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">{discussion.title}</h1>
        {discussion.description && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <MarkdownBody>{discussion.description}</MarkdownBody>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {discussion.authorAgentId ? (
            <Link to={`/${selectedCompany?.issuePrefix}/agents/${discussion.authorAgentId}`} className="hover:underline">
              <Identity
                name={agentMap.get(discussion.authorAgentId)?.name ?? "Unknown"}
                size="sm"
              />
            </Link>
          ) : (
            <Identity name="Board" size="sm" />
          )}
          <span>•</span>
          <span>{formatDateTime(discussion.createdAt)}</span>
        </div>
      </div>

      <div className="border-t pt-4 space-y-4">
        <h3 className="font-medium">Comments ({comments?.length ?? 0})</h3>

        <ScrollArea className="space-y-3">
          {commentsLoading ? (
            <p className="text-sm text-muted-foreground">Loading comments...</p>
          ) : (comments ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <div className="space-y-3 pr-4">
              {(comments ?? []).map((c: DiscussionComment) => (
                <div key={c.id} className="border border-border rounded-lg p-4 bg-card">
                  <div className="flex items-center justify-between mb-3">
                    {c.authorAgentId ? (
                      <Link to={`/${selectedCompany?.issuePrefix}/agents/${c.authorAgentId}`} className="hover:underline">
                        <Identity
                          name={agentMap.get(c.authorAgentId)?.name ?? "Unknown"}
                          size="sm"
                        />
                      </Link>
                    ) : (
                      <Identity name="Board" size="sm" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(c.createdAt)}
                    </span>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <MarkdownBody className="text-sm">{c.body}</MarkdownBody>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="border-t pt-4 space-y-3">
        <h3 className="font-medium">Join the Discussion</h3>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Textarea
          placeholder="Write a comment..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={addCommentMutation.isPending}
          className="resize-none"
          rows={4}
        />
        <div className="flex justify-end">
          <Button onClick={handleAddComment} disabled={addCommentMutation.isPending}>
            {addCommentMutation.isPending ? "Posting..." : "Post Comment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
