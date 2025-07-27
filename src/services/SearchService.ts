import * as vscode from 'vscode';

export interface SearchResult {
    key: string;
    summary: string;
    matchType: 'key' | 'summary' | 'both';
    matchIndex: number;
}

export class SearchService {
    /**
     * Search issues using case-sensitive 'includes' matching
     */
    public searchIssues(issues: Array<{ key: string; summary: string; }>, searchTerm: string): SearchResult[] {
        if (!searchTerm || searchTerm.trim() === '') {
            return issues.map((issue, index) => ({
                key: issue.key,
                summary: issue.summary,
                matchType: 'both' as const,
                matchIndex: index
            }));
        }

        const results: SearchResult[] = [];
        const term = searchTerm.trim();

        issues.forEach((issue, index) => {
            const keyMatch = issue.key.toLowerCase().includes(term.toLowerCase());
            const summaryMatch = issue.summary.toLowerCase().includes(term.toLowerCase());

            if (keyMatch || summaryMatch) {
                results.push({
                    key: issue.key,
                    summary: issue.summary,
                    matchType: keyMatch && summaryMatch ? 'both' : (keyMatch ? 'key' : 'summary'),
                    matchIndex: index
                });
            }
        });

        return results;
    }

    /**
     * Search for exact matches (case-sensitive)
     */
    public searchExactMatch(issues: Array<{ key: string; summary: string; }>, searchTerm: string): SearchResult[] {
        if (!searchTerm || searchTerm.trim() === '') {
            return [];
        }

        const results: SearchResult[] = [];
        const term = searchTerm.trim();

        issues.forEach((issue, index) => {
            const keyMatch = issue.key === term;
            const summaryMatch = issue.summary === term;

            if (keyMatch || summaryMatch) {
                results.push({
                    key: issue.key,
                    summary: issue.summary,
                    matchType: keyMatch && summaryMatch ? 'both' : (keyMatch ? 'key' : 'summary'),
                    matchIndex: index
                });
            }
        });

        return results;
    }

    /**
     * Search for issues that start with the search term (case-sensitive)
     */
    public searchStartsWith(issues: Array<{ key: string; summary: string; }>, searchTerm: string): SearchResult[] {
        if (!searchTerm || searchTerm.trim() === '') {
            return [];
        }

        const results: SearchResult[] = [];
        const term = searchTerm.trim();

        issues.forEach((issue, index) => {
            const keyMatch = issue.key.toLowerCase().startsWith(term.toLowerCase());
            const summaryMatch = issue.summary.toLowerCase().startsWith(term.toLowerCase());

            if (keyMatch || summaryMatch) {
                results.push({
                    key: issue.key,
                    summary: issue.summary,
                    matchType: keyMatch && summaryMatch ? 'both' : (keyMatch ? 'key' : 'summary'),
                    matchIndex: index
                });
            }
        });

        return results;
    }

    /**
     * Highlight search terms in text (simplified version)
     */
    public highlightSearchTerm(text: string, searchTerm: string): string {
        if (!searchTerm || searchTerm.trim() === '') {
            return text;
        }

        // Simple highlighting - wrap matches in <mark> tags
        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    /**
     * Get search suggestions based on partial input
     */
    public getSearchSuggestions(issues: Array<{ key: string; summary: string; }>, partialInput: string, maxSuggestions: number = 10): string[] {
        if (!partialInput || partialInput.trim() === '') {
            return [];
        }

        const suggestions = new Set<string>();
        const term = partialInput.trim().toLowerCase();

        issues.forEach(issue => {
            if (issue.key.toLowerCase().includes(term)) {
                suggestions.add(issue.key);
            }
            if (issue.summary.toLowerCase().includes(term)) {
                suggestions.add(issue.summary);
            }
        });

        return Array.from(suggestions).slice(0, maxSuggestions);
    }

    /**
     * Advanced search with multiple criteria
     */
    public advancedSearch(issues: Array<{ key: string; summary: string; }>, criteria: {
        searchTerm?: string;
        exactMatch?: boolean;
        startsWith?: boolean;
        maxResults?: number;
    }): SearchResult[] {
        let results: SearchResult[] = [];

        if (criteria.searchTerm) {
            if (criteria.exactMatch) {
                results = this.searchExactMatch(issues, criteria.searchTerm);
            } else if (criteria.startsWith) {
                results = this.searchStartsWith(issues, criteria.searchTerm);
            } else {
                results = this.searchIssues(issues, criteria.searchTerm);
            }
        } else {
            results = this.searchIssues(issues, '');
        }

        if (criteria.maxResults) {
            results = results.slice(0, criteria.maxResults);
        }

        return results;
    }
} 