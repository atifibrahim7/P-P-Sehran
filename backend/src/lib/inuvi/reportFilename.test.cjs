const test = require('node:test');
const assert = require('node:assert/strict');
const { parseInuviReportFilename } = require('./reportFilename');

test('parses the agreed convention with a single-segment clinic name', () => {
	const r = parseInuviReportFilename('The National Blood Test Clinic.0000652404-1.1234543456342.Atif Ibrahim.Abbasi.20260615110000');
	assert.deepEqual(r, {
		clinicName: 'The National Blood Test Clinic',
		inuviReference: '0000652404-1',
		policyNumber: '1234543456342',
		firstName: 'Atif Ibrahim',
		lastName: 'Abbasi',
		timestamp: '20260615110000',
	});
});

test('clinic name containing dots is still reassembled correctly', () => {
	const r = parseInuviReportFilename('Acme Labs, Inc..0000000001-1.POL123.Jane.Doe.20260101000000');
	assert.equal(r.clinicName, 'Acme Labs, Inc.');
	assert.equal(r.policyNumber, 'POL123');
});

test('returns null when the filename does not match the convention', () => {
	assert.equal(parseInuviReportFilename('random-report'), null);
	assert.equal(parseInuviReportFilename('a.b.c'), null);
	assert.equal(parseInuviReportFilename(''), null);
});
