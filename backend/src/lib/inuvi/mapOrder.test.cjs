const test = require('node:test');
const assert = require('node:assert/strict');
const { mapGenderToInuvi, mapSmokerToInuvi, formatDateOfBirth, buildCreateOrderExamRequest, validateApplicantPrerequisites } = require('./mapOrder');

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

test('formatDateOfBirth returns MM/DD/YYYY', () => {
	assert.equal(formatDateOfBirth(new Date('1990-01-02T12:34:56.000Z')), '01/02/1990');
	assert.equal(formatDateOfBirth('1990-12-31'), '12/31/1990');
});

test('buildCreateOrderExamRequest maps Inuvi payload for nurse visits', () => {
	const body = buildCreateOrderExamRequest({ labTestCode: 'LFT' }, 1);
	assert.deepEqual(body, {
		ExamType: 1,
		SpecialInstruction: '',
		SpecialExaminerInstruction: '',
		IsUrgent: false,
		Requirements: [{ Code: 'LFT' }],
	});
});

test('buildCreateOrderExamRequest maps Inuvi payload for diagnostic centre', () => {
	const body = buildCreateOrderExamRequest({ labTestCode: 'LFT' }, 1, { includeDiagnosticCentreCode: true });
	assert.deepEqual(body.Requirements, [{ Code: 'LFT' }, { Code: 'LDC' }]);
});

test('buildCreateOrderExamRequest maps Inuvi payload for kit fulfilment', () => {
	const body = buildCreateOrderExamRequest({ labTestCode: 'ENDO1', description: 'Finger-prick home kit' }, 5, {
		sampleToLabId: 'E54537E1-E8F8-E511-8134-025FE46D3D9D',
	});
	assert.deepEqual(body, {
		ExamType: 5,
		SpecialInstruction: '',
		SpecialExaminerInstruction: '',
		IsUrgent: false,
		Requirements: [{ Code: 'ENDO1' }],
		SampleToLabId: 'E54537E1-E8F8-E511-8134-025FE46D3D9D',
		VacutainerTypes: [2],
	});
});

test('validateApplicantPrerequisites catches missing phone', () => {
	const msg = validateApplicantPrerequisites(
		{ forenames: 'A', surname: 'B', dateOfBirth: new Date('1990-01-01'), policyNumber: 'P1' },
		[{ addressLine1: '1 St', city: 'London', country: 'UK', postcode: 'SW1A 1AA' }],
		[{ phoneType: 'MOBILE', phoneNumber: '' }],
	);
	assert.ok(msg);
});
