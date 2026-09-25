// Notes in this Design Lab live only in the current browser session.
export type SessionNote = {
  id: string;
  reconciliationId: string;
  sourceId: string;
  text: string;
  author: string;
  role: string;
  createdAt: string;
};

export type SessionAction = {
  id: string;
  reconciliationId: string;
  sourceId: string;
  title: string;
  detail: string;
  actor: string;
  createdAt: string;
  changes?: { field: string; before: string; after: string }[];
};

export type SavedOperationView = {
  id: string;
  name: string;
  filter: "all" | "action" | "mine" | "unidentified";
  query: string;
};
