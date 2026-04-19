/** Map API (lowercase) roles to Prisma enum values */
const API_TO_DB = {
	admin: 'ADMIN',
	practitioner: 'PRACTITIONER',
	patient: 'PATIENT',
};

const DB_TO_API = {
	ADMIN: 'admin',
	PRACTITIONER: 'practitioner',
	PATIENT: 'patient',
};

function toDbRole(apiRole) {
	return API_TO_DB[apiRole] ?? null;
}

function toApiRole(dbRole) {
	return DB_TO_API[dbRole] ?? dbRole;
}

module.exports = { API_TO_DB, DB_TO_API, toDbRole, toApiRole };
