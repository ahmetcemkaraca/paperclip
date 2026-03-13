export interface Discussion {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  authorAgentId: string | null;
  authorUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscussionComment {
  id: string;
  companyId: string;
  discussionId: string;
  authorAgentId: string | null;
  authorUserId: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}
