export const buyEvent = `SELECT
    COUNT(e.*) as count,
    COALESCE(MAX(e.meta::decimal), 0) as max
    FROM event e
    LEFT JOIN nft_entity ne on ne.id = e.nft_id
    WHERE e.interaction = 'BUY' AND ne.collection_id = $1;`;

export const collectionEventHistory = (
  idList: string,
  dateRange: string
) => `SELECT
	ce.id as id,
	DATE(e.timestamp),
	count(e)
FROM nft_entity ne
JOIN collection_entity ce on ce.id = ne.collection_id
JOIN event e on e.nft_id = ne.id
WHERE e.interaction = 'BUY'
and ce.id in (${idList})
${dateRange}
GROUP BY ce.id, DATE(e.timestamp)
ORDER BY DATE(e.timestamp)`;

export const lastEventQuery = (whereCondition: string) => `SELECT
    DISTINCT ne.id as id,
    ne.name as name,
    ne.issuer as issuer,
    ne.metadata as metadata,
    e.current_owner,
    me.image as image,
    me.animation_url,
    MAX(e.timestamp) as timestamp,
    MAX(e.meta::decimal) as value,
    ne.collection_id as collection_id,
    ce.name as collection_name

FROM event e
    JOIN nft_entity ne on e.nft_id = ne.id
    LEFT join metadata_entity me on me.id = ne.metadata
    LEFT JOIN collection_entity ce on ne.collection_id = ce.id
WHERE
    e.interaction = $1
    AND ne.burned = false
    ${whereCondition}
GROUP BY ne.id, me.id, e.current_owner, me.image, ce.name
ORDER BY MAX(e.timestamp) DESC
LIMIT $2 OFFSET $3`;
