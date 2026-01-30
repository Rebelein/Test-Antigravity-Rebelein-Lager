## 2024-05-22 - [Optimized Commissions Data Fetching]
**Learning:** The application was fetching all articles (thousands) and all commission items (including potential base64 attachment data) on initial load of the Commissions list. This caused massive performance degradation and blocking on mobile devices.
**Action:** Always verify nested joins in Supabase queries. Avoid `select('*')` on tables that might contain large binary data (like images) or when fetching list views. Implement lazy loading for large lookup tables (like articles) that are only needed in specific modals.
