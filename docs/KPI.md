# KPI definitions and reporting rules

Do not enter invented values. Store the raw test results and calculate the report from them.

| KPI | Definition | Initial acceptance goal |
|---|---|---|
| Overselling violations | In a fixed-stock test, count successful reserved units beyond initial available units | 0 |
| Stock invariant violations | Count products where `on_hand < 0`, `reserved < 0`, or `reserved > on_hand` | 0 |
| Ledger completeness | Committed stock-changing operations with matching ledger events / all committed stock-changing operations | 100% for defined scope |
| Idempotency failures | Repeated idempotency keys that produce duplicate stock movements | 0 |
| Valid-request success rate | Successful valid requests / all valid requests; report out-of-stock rejections separately | Set after baseline |
| Latency | p50 and p95 response time under specified load | Establish baseline first |
| Throughput | completed requests / elapsed seconds | Report measured value |
| Search performance | Compare baseline and optimized approach using identical inputs | Report measured difference |
| Audit traceability | In-scope operations with actor, request ID, timestamp and outcome / all in-scope operations | 100% for defined scope |

## Experiment reporting
Record:
- Date and commit hash
- OS and hardware
- Node.js and PostgreSQL versions
- Dataset size and starting stock
- Number of requests and concurrency level
- Number of repetitions
- p50, p95, throughput, successes, expected rejections, unexpected errors
- Final stock invariants and ledger consistency result

Do not claim zero latency or universal race-freedom. Explain the scope and limitations of each test.
