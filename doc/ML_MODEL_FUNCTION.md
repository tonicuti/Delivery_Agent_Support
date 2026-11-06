# ML Model’s Role in the Delivery Risk Agent

## Purpose

The ML model estimates the probability that an open order’s **original planned delivery will miss the customer’s agreed delivery window**. It gives the regional planner an early signal while there is still time to act.

For each eligible order, the model produces `p_late`, a value from 0 to 1. A score of 0.75 means the model estimates a 75% chance of late original delivery. It is a prediction based on the evidence available when the order was scored.

## What the model receives

The system creates an order snapshot before scoring. That snapshot records the promise version and the information available at that decision time, such as:

- Time remaining until the promised delivery deadline
- Order size, products, stock status, and handling needs
- Warehouse progress, including picking, packing, and loading
- Shipment assignment, departure, route status, and ETA changes
- Destination, travel conditions, holidays, and weather when available

The snapshot must distinguish missing information from a confirmed value. It must also retain when each piece of evidence was recorded. For example, a warehouse update entered at 10:20 cannot be used to explain a score produced at 10:10.

## What the model produces

The model returns a probability and the system saves it with the snapshot ID and model version. The proposed risk bands are:

| Probability of late delivery | Risk level | Planner treatment |
|---|---|---|
| Below 0.20 | Low | Continue monitoring |
| 0.20 through 0.50 | Medium | Review if capacity permits |
| Above 0.50 | High | Add to the live worklist and alert the regional planner |

The model also helps rank orders. At shift start, the system saves the top **K** eligible orders that the planning team has capacity to review. New scores can change the live worklist during the shift, while the saved shift list preserves what was known at its start.

## How the agent uses the score

A High score triggers the agent to gather current order, warehouse, and transport evidence. The agent records a suggested check or request, a suggested owner team, and suggested response and escalation deadlines. The regional planner reviews and may edit these suggestions before assigning work.

If newer evidence conflicts with the score, the planner still receives the alert with an explanation of the discrepancy. That evidence also triggers rescoring. The ML model supplies the risk estimate. The planner chooses the action and owner.

## Where scoring stops

The system scores eligible open orders after meaningful updates and on a schedule as the deadline approaches. It stops predictive scoring when an order is delivered, cancelled, or a representative authorizes replacement.

An authorized replacement follows a separate urgent task workflow. Its urgency comes from approved replacement units still awaiting acceptance, rather than from `p_late`.

## How to evaluate the model

Each saved pre-authorization score is evaluated against whether the **original planned delivery** was completed by the deadline in the promise version attached to its snapshot. This outcome is distinct from whether the full customer order was acceptable by that deadline and whether a later replacement met its own promise.

The primary operational measure is **Precision@K**: of the top K orders planners could review, how many were actually late? Recall@K measures how many late orders appeared in that list. Average precision evaluates the ranking more broadly.

The database walkthrough contains synthetic orders and illustrative scores. Once sufficient reliable outcome history exists, the pilot can compare Logistic Regression and LightGBM. Until then, the example scores demonstrate the workflow rather than measured predictive performance.