const test = require('node:test');
const assert = require('node:assert/strict');
const { mapGenderToInuvi, mapSmokerToInuvi, buildCreateOrderExamRequest, validateApplicantPrerequisites } = require('./mapOrder');

test('mapGenderToInuvi', () => {
	assert.equal(mapGenderToInuvi('MALE'), 'Male');
	assert.equal(mapGenderToInuvi('FEMALE'), 'Female');
	assert.equal(mapGenderToInuvi('UNKNOWN'), 'Unknown');
});

test('mapSmokerToInuvi', () => {
	assert.equal(mapSmokerToInuvi('SMOKER'), 'Smoker');
	assert.equal(mapSmokerToInuvi('NON_SMOKER'), 'NonSmoker');
	assert.equal(mapSmokerToInuvi('UNKNOWN'), 'Unknown');
});

test('buildCreateOrderExamRequest uses camelCase', () => {
	const body = buildCreateOrderExamRequest({ labTestCode: 'ABC' }, 42);
	assert.deepEqual(body, { examType: 42, requirements: [{ code: 'ABC' }] });
});

test('validateApplicantPrerequisites catches missing phone', () => {
	const msg = validateApplicantPrerequisites(
		{ forenames: 'A', surname: 'B', dateOfBirth: new Date('1990-01-01'), policyNumber: 'P1' },
		[{ addressLine1: '1 St', city: 'London', country: 'UK', postcode: 'SW1A 1AA' }],
		[{ phoneType: 'MOBILE', phoneNumber: '' }],
	);
	assert.ok(msg);
});
