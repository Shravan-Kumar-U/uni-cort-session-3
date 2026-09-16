import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
} from './games';

async function seedFilterFixture(db: Database): Promise<{ strategyCategory: { id: number; name: string }; puzzleCategory: { id: number; name: string }; pubOne: { id: number; name: string }; pubTwo: { id: number; name: string } }> {
    const [strategyCategory] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id, name: categories.name });
    const [puzzleCategory] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'cat' })
        .returning({ id: categories.id, name: categories.name });

    const [pubOne] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id, name: publishers.name });
    const [pubTwo] = await db
        .insert(publishers)
        .values({ name: 'Pub Two', description: 'pub' })
        .returning({ id: publishers.id, name: publishers.name });

    await db.insert(games).values([
        {
            title: 'Alpha Strategy',
            description: 'A strategy game',
            starRating: 4.2,
            categoryId: strategyCategory.id,
            publisherId: pubOne.id,
        },
        {
            title: 'Beta Puzzle',
            description: 'A puzzle game',
            starRating: 3.8,
            categoryId: puzzleCategory.id,
            publisherId: pubTwo.id,
        },
        {
            title: 'Gamma Strategy',
            description: 'Another strategy game',
            starRating: 4.5,
            categoryId: strategyCategory.id,
            publisherId: pubOne.id,
        },
    ]);

    return {
        strategyCategory,
        puzzleCategory,
        pubOne,
        pubTwo,
    };
}

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('filters games by publisher', async () => {
        const { pubOne } = await seedFilterFixture(db);

        const filtered = await getAllGames(db, { publisherId: pubOne.id });

        expect(filtered.map((game) => game.title)).toEqual(['Alpha Strategy', 'Gamma Strategy']);
        expect(filtered.every((game) => game.publisher?.id === pubOne.id)).toBe(true);
    });

    it('filters games by category', async () => {
        const { strategyCategory } = await seedFilterFixture(db);

        const filtered = await getAllGames(db, { categoryId: strategyCategory.id });

        expect(filtered.map((game) => game.title)).toEqual(['Alpha Strategy', 'Gamma Strategy']);
        expect(filtered.every((game) => game.category?.id === strategyCategory.id)).toBe(true);
    });

    it('returns an empty list when filters match no games', async () => {
        await seedFilterFixture(db);

        const filtered = await getAllGames(db, { categoryId: 99999 });

        expect(filtered).toEqual([]);
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
