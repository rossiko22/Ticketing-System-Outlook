export interface MailAccess { userId: string; manage: boolean }
export interface MailFilters {
    offset: number;
    status: 'all' | 'unassigned' | 'progress' | 'finished';
    view: 'all' | 'assigned' | 'mine';
    assignee: string | null;
    closedBy: string | null;
    search: string;
    sort: 'newest' | 'oldest';
}
export const defaultFilters: MailFilters = { offset: 0, status: 'all', view: 'all', assignee: null, closedBy: null, search: '', sort: 'newest' };
