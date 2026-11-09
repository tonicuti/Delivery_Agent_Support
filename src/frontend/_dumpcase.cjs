const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('../backend/practice_delivery/my_practice.db', { readOnly: true });
function show(label, sql) {
  console.log('=== ' + label + ' ===');
  try { console.dir(db.prepare(sql).all(), { depth: null, maxArrayLength: null }); }
  catch (e) { console.log('ERR', e.message); }
  console.log();
}
show('customer_order', `SELECT * FROM customer_order WHERE order_id IN (1001,1002,1003)`);
show('customer', `SELECT * FROM customer`);
show('promise_version', `SELECT * FROM promise_version WHERE order_id IN (1001,1002,1003)`);
show('order_line', `SELECT * FROM order_line WHERE order_id IN (1002,1003)`);
show('product', `SELECT * FROM product`);
show('stock_event', `SELECT * FROM stock_event WHERE order_id IN (1002,1003) ORDER BY recorded_at_utc`);
show('shipment', `SELECT * FROM shipment WHERE shipment_id LIKE 'S100%'`);
show('shipment_item', `SELECT * FROM shipment_item WHERE order_id IN (1002,1003)`);
show('shipment_stop', `SELECT s.* FROM shipment_stop s JOIN shipment_item si ON si.shipment_id=s.shipment_id WHERE si.order_id IN (1002,1003) GROUP BY s.stop_id`);
show('warehouse_event', `SELECT * FROM warehouse_event WHERE shipment_id IN (SELECT shipment_id FROM shipment_item WHERE order_id IN (1002,1003)) ORDER BY recorded_at_utc`);
show('eta_update', `SELECT * FROM eta_update ORDER BY recorded_at_utc`);
show('travel_observation', `SELECT * FROM travel_observation`);
show('weather_observation', `SELECT * FROM weather_observation`);
show('holiday_observation', `SELECT * FROM holiday_observation`);
show('warehouse', `SELECT * FROM warehouse`);
show('carrier', `SELECT * FROM carrier`);
show('management_team', `SELECT * FROM management_team`);
show('planning_region', `SELECT * FROM planning_region`);
