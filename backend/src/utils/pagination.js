function parsePagination(query = {}) {
	const page = Number.parseInt(query.page, 10);
	const pageSize = Number.parseInt(query.pageSize, 10);
	const validPage = Number.isFinite(page) && page > 0 ? page : 1;
	const validPageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10;
	return { page: validPage, pageSize: Math.min(validPageSize, 100) };
}

function paginate(items, page, pageSize) {
	const total = items.length;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const safePage = Math.min(page, totalPages);
	const start = (safePage - 1) * pageSize;
	const pagedItems = items.slice(start, start + pageSize);
	return {
		items: pagedItems,
		pagination: {
			page: safePage,
			pageSize,
			total,
			totalPages
		}
	};
}

/** Server-side pagination when items are already a page slice */
function paginateResult(items, page, pageSize, total) {
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const safePage = Math.min(Math.max(1, page), totalPages);
	return {
		items,
		pagination: {
			page: safePage,
			pageSize,
			total,
			totalPages
		}
	};
}

module.exports = { parsePagination, paginate, paginateResult };

