import { api } from "./client";

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

export const discussionsApi = {
  list: (companyId: string) => api.get<Discussion[]>(`/companies/${companyId}/discussions`),
  get: (id: string) => api.get<Discussion>(`/discussions/${id}`),
  create: (companyId: string, data: { title: string; description?: string | null }) =>
    api.post<Discussion>(`/companies/${companyId}/discussions`, data),
  listComments: (discussionId: string) =>
    api.get<DiscussionComment[]>(`/discussions/${discussionId}/comments`),
  addComment: (discussionId: string, body: string) =>
    api.post<DiscussionComment>(`/discussions/${discussionId}/comments`, { body }),
};
