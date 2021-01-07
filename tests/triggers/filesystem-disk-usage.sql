SELECT
    host.name as hostname,
    system.filesystem.mount_point as mount_point,
    ROUND(MIN(system.filesystem.used.pct) * 100,2) as used

FROM metricbeat

WHERE system.filesystem.mount_point NOT IN ('/hostfs/boot')
    AND system.filesystem.type = 'ext4'
    AND "@timestamp" > NOW() - INTERVAL 10 MINUTE

GROUP BY host.name,system.filesystem.mount_point
