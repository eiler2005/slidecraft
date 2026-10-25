# Diagram patterns: meaning before layout

Use one main relationship per slide and the real schema from `slidecraft layouts`. Industry vocabulary is a pattern over native layouts; it does not create another template system. Quantities, outcomes and evidence remain visible in a static frame. Draw an overview and a detail slide if two mechanisms need full treatment.

| Pattern | Native starting point | Required meaning and evidence |
|---|---|---|
| Fan-in queue / bottleneck | `architecture`, `swimlane` | Named arrivals, queue/count/capacity with units, constrained service point and explicit admitted/deferred outcomes; a plain pipeline is insufficient |
| Stage framework | `service-blueprint` for its visibility semantics; otherwise `composition` + `data-table` | Stable stage/slot meanings and explicit N/A; do not rename arbitrary rows customer/frontstage/backstage |
| Unstructured input → durable artifact | `process-steps`, `architecture` | Source input, elicitation/validation and named output; do not imply that a decorative arrow validates data |
| Paired policy traces | `composition` of two `flowchart` exhibits | Same starting input, pass/fail/skipped outcomes and first divergence; preserve the relationship between the two traces |
| Secure paved road | `architecture`, `dependency-graph` | Explicit boundaries and permitted/forbidden paths; blocked paths require a label, not colour alone |
| Governance/control catalogue | `layer-stack`, `security-matrix` | Control, enforcement surface and ownership; access rights are not RACI responsibilities |
| Compensating security layers | `layer-stack` | What each layer mitigates, evidence and residual risk; band thickness is not risk reduction |
| Traceable block decomposition | `issue-tree` + explicit evidence table/notes | Stable IDs, per-block I/O, constraints and implementation references; do not claim SysML conformance |
| Lifecycle phase map | `state-machine` | Initial, reachable and terminal states; labelled wait/retry/cancel transitions |

IT current-state combines `architecture` with `coverage-map` and a sourced register. Medallion uses `layer-stack` for quality levels and `security-matrix` for access. Data-platform integration uses sources → services → consumers zones. Physical deployment details may be stated in component labels/registers; the current zone contract is not a full nested host/artifact deployment language.

For style and PowerPoint acceptance see `docs/how-to/create-diagrams.md` in the repository. For runtime contracts use the CLI; references never override a schema's capacity or invent unsupported fields.
