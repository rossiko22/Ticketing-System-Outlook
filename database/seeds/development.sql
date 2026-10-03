BEGIN;

INSERT INTO users (
    email,
    password_hash,
    role,
    avatar_path
)
VALUES
    (
        'developer@example.test',
        '$argon2id$v=19$m=131072,p=2,t=3$qhStcSHaHTH5BgEelEqLxQ$OkG/nMRzdh3uXc281iDWdhzkKL2HjsfQLDY25RUSfpU',
        1,
        '/avatars/default.png'
    ),
    (
        'manager@example.test',
        '$argon2id$v=19$m=131072,p=2,t=3$6sea5MJSCJzxOY6JYnKdgw$k02RP/Pl24qt5dfapSOA2p6XB3D4AtR9vxe1BGS0MYs',
        2,
        '/avatars/default.png'
    )
    ON CONFLICT (lower(email)) DO NOTHING;

COMMIT;