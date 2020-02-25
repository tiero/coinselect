// baseline estimates, used to improve performance
var TX_VERSION = 4
var TX_LOCKTIME = 4
var TX_IN_COUNT = 1
var TX_OUT_COUNT = 1
var TX_FLAG = 1
var TX_EMPTY_SIZE = TX_VERSION + TX_LOCKTIME + TX_IN_COUNT + TX_OUT_COUNT + TX_FLAG

var TX_PREV_OUT_HASH = 32
var TX_PREV_OUT_INDEX = 4
var TX_INPUT_SEQUENCE = 4
var TX_INPUT_SCRIPT_LENGHT = 1  
var TX_INPUT_BASE = TX_PREV_OUT_HASH + TX_PREV_OUT_INDEX + TX_INPUT_SCRIPT_LENGHT + TX_INPUT_SEQUENCE
var TX_INPUT_PUBKEYHASH = 91

var TX_OUTPUT_ASSET = 32 + 1
var TX_OUTPUT_NONCE = 1
var TX_OUTPUT_VALUE = 8 + 1
var TX_OUTPUT_BASE = TX_OUTPUT_VALUE + TX_OUTPUT_ASSET + TX_OUTPUT_NONCE 
var TX_OUTPUT_PUBKEYHASH = 24

function inputBytes (input) {
  return TX_INPUT_BASE + TX_INPUT_PUBKEYHASH
}

function outputBytes (output) {
  return TX_OUTPUT_BASE + (output.script ? output.script.length : TX_OUTPUT_PUBKEYHASH)
}

function dustThreshold (output, feeRate) {
  /* ... classify the output for input estimate  */
  return inputBytes({}) * feeRate
}

function transactionBytes (inputs, outputs) {
  return TX_EMPTY_SIZE +
    inputs.reduce(function (a, x) { return a + inputBytes(x) }, 0) +
    outputs.reduce(function (a, x) { return a + outputBytes(x) }, 0)
}

function uintOrNaN (v) {
  if (typeof v !== 'number') return NaN
  if (!isFinite(v)) return NaN
  if (Math.floor(v) !== v) return NaN
  if (v < 0) return NaN
  return v
}

function sumForgiving (range) {
  return range.reduce(function (a, x) { return a + (isFinite(x.value) ? x.value : 0) }, 0)
}

function sumOrNaN (range) {
  return range.reduce(function (a, x) { return a + uintOrNaN(x.value) }, 0)
}

var BLANK_OUTPUT = outputBytes({})

function finalize (inputs, outputs, feeRate) {
  var bytesAccum = transactionBytes(inputs, outputs)
  var feeAfterExtraOutput = feeRate * (bytesAccum + BLANK_OUTPUT + BLANK_OUTPUT)
  var remainderAfterExtraOutput = sumOrNaN(inputs) - (sumOrNaN(outputs) + feeAfterExtraOutput)

  // is it worth a change output?
  if (remainderAfterExtraOutput > dustThreshold({}, feeRate)) {
    outputs = outputs.concat({ value: remainderAfterExtraOutput })
  }

  var fee = sumOrNaN(inputs) - sumOrNaN(outputs)
  if (!isFinite(fee)) return { fee: feeRate * bytesAccum }

  return {
    inputs: inputs,
    outputs: outputs,
    fee: fee
  }
}

module.exports = {
  dustThreshold: dustThreshold,
  finalize: finalize,
  inputBytes: inputBytes,
  outputBytes: outputBytes,
  sumOrNaN: sumOrNaN,
  sumForgiving: sumForgiving,
  transactionBytes: transactionBytes,
  uintOrNaN: uintOrNaN
}
