const competitionEntriesSql = `
  CREATE TABLE IF NOT EXISTS competition_entries (
    id TEXT PRIMARY KEY,
    competition_id TEXT NOT NULL,
    gallery_id TEXT NOT NULL,
    gallery_owner_id TEXT NOT NULL,
    statement TEXT NOT NULL,
    submission_json TEXT,
    assets_json TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    rank INTEGER,
    vote_count INTEGER NOT NULL DEFAULT 0,
    submitted_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
    FOREIGN KEY(gallery_id) REFERENCES galleries(id) ON DELETE CASCADE,
    FOREIGN KEY(gallery_owner_id) REFERENCES users(id) ON DELETE CASCADE
  );
`;

const competitionVotesSql = `
  CREATE TABLE IF NOT EXISTS competition_votes (
    id TEXT PRIMARY KEY,
    competition_id TEXT NOT NULL,
    entry_id TEXT NOT NULL,
    voter_user_id TEXT NOT NULL,
    voter_name TEXT NOT NULL,
    voter_email TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
    FOREIGN KEY(entry_id) REFERENCES competition_entries(id) ON DELETE CASCADE
  );
`;

export function initCompetitionEntrySchema(database) {
  return new Promise((resolve, reject) => {
    let failed = false;

    const handleError = (label, { ignoreDuplicateColumn = false, final = false } = {}) => (error) => {
      const isIgnored = ignoreDuplicateColumn
        && String(error?.message || '').includes('duplicate column name');

      if (error && !isIgnored && !failed) {
        failed = true;
        reject(new Error(`[db] ${label}: ${error.message}`, { cause: error }));
        return;
      }

      if (final && !failed) resolve();
    };

    database.serialize(() => {
      database.run(
        competitionEntriesSql,
        handleError('failed to create competition_entries table'),
      );
      database.run(
        'ALTER TABLE competition_entries ADD COLUMN submission_json TEXT',
        handleError('failed to add submission_json column', { ignoreDuplicateColumn: true }),
      );
      database.run(
        competitionVotesSql,
        handleError('failed to create competition_votes table'),
      );
      database.run(
        'ALTER TABLE competition_votes ADD COLUMN voter_user_id TEXT',
        handleError('failed to add voter_user_id column', { ignoreDuplicateColumn: true }),
      );
      database.run(
        'CREATE INDEX IF NOT EXISTS idx_competition_entries_competition_id ON competition_entries(competition_id)',
        handleError('failed to create competition entry index'),
      );
      database.run(
        'CREATE INDEX IF NOT EXISTS idx_competition_votes_entry_id ON competition_votes(entry_id)',
        handleError('failed to create competition vote entry index'),
      );
      database.run(
        `CREATE TRIGGER IF NOT EXISTS trg_competition_votes_require_voter_user
         BEFORE INSERT ON competition_votes
         WHEN NEW.voter_user_id IS NULL OR trim(NEW.voter_user_id) = ''
         BEGIN
           SELECT RAISE(ABORT, 'voter_user_id is required');
         END`,
        handleError('failed to create competition vote identity trigger'),
      );
      database.run(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_competition_votes_unique_voter_user ON competition_votes(competition_id, entry_id, voter_user_id)',
        handleError('failed to create competition vote uniqueness index', { final: true }),
      );
    });
  });
}
