const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('../backend/practice_delivery/my_practice.db', { readOnly: true });
function show(label, sql) {
  console.log('=== ' + label + ' ===');
  try { console.dir(db.prepare(sql).all(), { depth: null, maxArrayLength: null }); }
  catch (e) { console.log('ERR', e.message); }
  console.log();
}
show('counts', `SELECT 'orders' t, count(*) n FROM customer_order UNION ALL SELECT 'snapshot',count(*) FROM order_snapshot UNION ALL SELECT 'risk_score',count(*) FROM risk_score UNION ALL SELECT 'episode',count(*) FROM risk_episode UNION ALL SELECT 'worklist',count(*) FROM worklist_item UNION ALL SELECT 'agent_run',count(*) FROM agent_run UNION ALL SELECT 'recommendation',count(*) FROM agent_recommendation UNION ALL SELECT 'notification',count(*) FROM simulated_notification UNION ALL SELECT 'planner_feedback',count(*) FROM planner_feedback UNION ALL SELECT 'model_input_snapshot',count(*) FROM model_input_snapshot UNION ALL SELECT 'lifecycle',count(*) FROM order_lifecycle_event UNION ALL SELECT 'outcome',count(*) FROM original_delivery_outcome`);
show('worklist_item', `SELECT * FROM worklist_item`);
show('risk_episode', `SELECT * FROM risk_episode`);
show('risk_score', `SELECT * FROM risk_score`);
show('agent_run', `SELECT run_id,order_id,decision_time_utc,status,eligibility_reason,score_id,next_due_at_utc FROM agent_run`);
show('agent_recommendation', `SELECT recommendation_id,run_id,score_id,action_id,validation_status,created_at_utc,output_json FROM agent_recommendation`);
show('simulated_notification', `SELECT notification_id,episode_id,recommendation_id,kind,created_at_utc,acknowledged_at_utc,payload_json FROM simulated_notification`);
show('planner_feedback', `SELECT * FROM planner_feedback`);
show('order_snapshot', `SELECT snapshot_id,order_id,as_of_utc,promised_to_utc,hours_to_deadline,customer_type,stock_status,warehouse_stage,planned_eta_at_utc,current_eta_at_utc,eta_delay_minutes,region_name,warehouse_name,carrier_name,weather_severity,holiday_flag FROM order_snapshot`);
show('model_input_snapshot', `SELECT * FROM model_input_snapshot`);
show('order_lifecycle_event', `SELECT * FROM order_lifecycle_event`);
show('original_delivery_outcome', `SELECT * FROM original_delivery_outcome`);
show('delivery_site', `SELECT * FROM delivery_site`);
