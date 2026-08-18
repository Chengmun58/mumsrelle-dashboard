# Keyword source notes

## Google Search Console

Official Search Analytics query documentation: https://developers.google.com/webmaster-tools/v1/searchanalytics/query

The API accepts a date range, dimensions such as date, country, device, page, and query, plus filters and row limits. The response provides clicks, impressions, CTR, and position. Results are sorted by clicks and the API does not guarantee every row because of internal limits. Authorization requires the webmasters.readonly or webmasters scope.

## Ahrefs

Official keyword history documentation: https://docs.ahrefs.com/en/api/reference/gsc/get-keyword-history

Ahrefs API v3 documentation root: https://docs.ahrefs.com/

The keyword-history endpoint supports filters expressed as JSON boolean expressions. It is intended as an external ranking/history supplement, not a replacement for Search Console performance metrics.

## Semrush

Official domain reports documentation: https://developer.semrush.com/api/v3/seo/domain-reports/

Semrush API overview: https://developer.semrush.com/api/v4/introduction/semrush-api-overview

The domain report format includes keyword, current and previous position, position difference, search volume, URL, traffic percentage, CPC, competition, number of results, and trends. It is an external ranking/market supplement.

## Offline mode decision

Because no API credentials are available, the product uses CSV/JSON offline import as the only real data source for this iteration. The data contract keeps source metadata so future GSC/Ahrefs/Semrush adapters can be added without changing the visualization layer. No keyword metrics are fabricated.
