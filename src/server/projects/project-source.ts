/**
 * Port for "where the project list comes from". BookCare owns the list; MYOIL reads it only.
 * How the two connect is NOT decided yet (the dev team proposes) — so the rest of MYOIL depends on
 * this interface, and the choice (shared DB view / API / scheduled import) is one adapter to write.
 */
export type ProjectRecord = {
  refCode: string;
  projectCode: string | null;
  name: string;
  isActive: boolean;
};

export interface ProjectSource {
  list(): Promise<ProjectRecord[]>;
}

/** fixed list — for the seed and tests */
export class StaticProjectSource implements ProjectSource {
  constructor(private readonly rows: readonly ProjectRecord[]) {}
  async list() {
    return [...this.rows];
  }
}
