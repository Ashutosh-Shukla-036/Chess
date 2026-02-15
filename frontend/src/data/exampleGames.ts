/**
 * Example Chess Games for Demo/Testing
 */

export interface ExampleGame {
    id: string;
    title: string;
    description: string;
    pgn: string;
    highlights: string[];
}

export const exampleGames: ExampleGame[] = [
    {
        id: 'game-of-century',
        title: "Fischer's Game of the Century",
        description: "13-year-old Bobby Fischer defeats Donald Byrne with a brilliant queen sacrifice",
        highlights: ['Brilliant queen sacrifice', 'Tactical masterpiece', 'Historic game'],
        pgn: `[Event "Third Rosenwald Trophy"]
[Site "New York, NY USA"]
[Date "1956.10.17"]
[Round "8"]
[White "Donald Byrne"]
[Black "Robert James Fischer"]
[Result "0-1"]
[WhiteElo ""]
[BlackElo ""]
[ECO "D92"]

1. Nf3 Nf6 2. c4 g6 3. Nc3 Bg7 4. d4 O-O 5. Bf4 d5 6. Qb3 dxc4 7. Qxc4 c6 8. e4 Nbd7 9. Rd1 Nb6 10. Qc5 Bg4 11. Bg5 Na4 12. Qa3 Nxc3 13. bxc3 Nxe4 14. Bxe7 Qb6 15. Bc4 Nxc3 16. Bc5 Rfe8+ 17. Kf1 Be6 18. Bxb6 Bxc4+ 19. Kg1 Ne2+ 20. Kf1 Nxd4+ 21. Kg1 Ne2+ 22. Kf1 Nc3+ 23. Kg1 axb6 24. Qb4 Ra4 25. Qxb6 Nxd1 26. h3 Rxa2 27. Kh2 Nxf2 28. Re1 Rxe1 29. Qd8+ Bf8 30. Nxe1 Bd5 31. Nf3 Ne4 32. Qb8 b5 33. h4 h5 34. Ne5 Kg7 35. Kg1 Bc5+ 36. Kf1 Ng3+ 37. Ke1 Bb4+ 38. Kd1 Bb3+ 39. Kc1 Ne2+ 40. Kb1 Nc3+ 41. Kc1 Rc2# 0-1`
    },
    {
        id: 'kasparov-immortal',
        title: "Kasparov's Immortal",
        description: "Garry Kasparov defeats Veselin Topalov with spectacular tactics",
        highlights: ['Amazing king walk', 'Brilliant sacrifices', 'Tactical brilliance'],
        pgn: `[Event "Hoogovens A Tournament"]
[Site "Wijk aan Zee NED"]
[Date "1999.01.20"]
[Round "4"]
[White "Garry Kasparov"]
[Black "Veselin Topalov"]
[Result "1-0"]
[WhiteElo "2812"]
[BlackElo "2700"]
[ECO "B06"]

1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7 8. Bh6 Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O 14. Nb3 exd4 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5 20. Qf4+ Ka7 21. Rhe1 d4 22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4 25. Re7+ Kb6 26. Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 29. Ra7 Bb7 30. Rxb7 Qc4 31. Qxf6 Kxa3 32. Qxa6+ Kxb4 33. c3+ Kxc3 34. Qa1+ Kd2 35. Qb2+ Kd1 36. Bf1 Rd2 37. Rd7 Rxd7 38. Bxc4 bxc4 39. Qxh8 Rd3 40. Qa8 c3 41. Qa4+ Ke1 42. f4 f5 43. Kc1 Rd2 44. Qa7 1-0`
    },
    {
        id: 'scholars-mate',
        title: "Scholar's Mate Example",
        description: "A quick checkmate pattern - common beginner trap",
        highlights: ['Quick checkmate', 'Beginner lesson', 'Tactical pattern'],
        pgn: `[Event "Casual Game"]
[Site "Online"]
[Date "2024.01.01"]
[Round "?"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0`
    }
];

/**
 * Get example game by ID
 */
export function getExampleGame(id: string): ExampleGame | undefined {
    return exampleGames.find(game => game.id === id);
}

/**
 * Get random example game
 */
export function getRandomExample(): ExampleGame {
    const index = Math.floor(Math.random() * exampleGames.length);
    return exampleGames[index];
}
