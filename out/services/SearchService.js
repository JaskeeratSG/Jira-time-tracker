"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
class SearchService {
    /**
     * Search issues using case-sensitive 'includes' matching
     */
    searchIssues(issues, searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            return issues.map((issue, index) => ({
                key: issue.key,
                summary: issue.summary,
                matchType: 'both',
                matchIndex: index
            }));
        }
        const results = [];
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
    searchExactMatch(issues, searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            return [];
        }
        const results = [];
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
    searchStartsWith(issues, searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            return [];
        }
        const results = [];
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
    highlightSearchTerm(text, searchTerm) {
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
    getSearchSuggestions(issues, partialInput, maxSuggestions = 10) {
        if (!partialInput || partialInput.trim() === '') {
            return [];
        }
        const suggestions = new Set();
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
    advancedSearch(issues, criteria) {
        let results = [];
        if (criteria.searchTerm) {
            if (criteria.exactMatch) {
                results = this.searchExactMatch(issues, criteria.searchTerm);
            }
            else if (criteria.startsWith) {
                results = this.searchStartsWith(issues, criteria.searchTerm);
            }
            else {
                results = this.searchIssues(issues, criteria.searchTerm);
            }
        }
        else {
            results = this.searchIssues(issues, '');
        }
        if (criteria.maxResults) {
            results = results.slice(0, criteria.maxResults);
        }
        return results;
    }
}
exports.SearchService = SearchService;
//# sourceMappingURL=SearchService.js.map