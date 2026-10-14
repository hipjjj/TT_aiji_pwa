import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateAmount} from '../src/amountExpression.mjs';
test('amount arithmetic honors precedence, parentheses and exact decimal rounding',()=>{
 for(const [input,cents] of [['20+8×2',3600],['(20+8)÷2',1400],['100-12.5*2',7500],['0.1+0.2',30],['1÷3',33],['1.005',101],['1/3*3',100],['.5+0.25',75],['２０＋８×２',3600],['20−(-5)',2500],['1000000',100000000]])assert.equal(calculateAmount(input),cents,input);
});
test('invalid, unsafe and out-of-range expressions never produce a saved amount',()=>{
 for(const input of ['', '20+', '(20+2', '2(3)', '1/0', '1/(2-2)', '0', '-1', '0.004', '1000000.001', 'alert(1)', '1e3', '2**3', '2..3', '2'.repeat(121)])assert.throws(()=>calculateAmount(input),undefined,input);
});
