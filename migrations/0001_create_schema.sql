-- Schema for the YoRadio station database.
CREATE TABLE IF NOT EXISTS Countries (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS Stations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    final_url TEXT NOT NULL,
    country_id INTEGER,
    FOREIGN KEY (country_id) REFERENCES Countries(id)
);

-- Required, not an optimization. D1 bills rows read; without these a
-- country-filtered page view scans all ~38k rows instead of one page.
CREATE INDEX IF NOT EXISTS idx_stations_country_id ON Stations(country_id);
CREATE INDEX IF NOT EXISTS idx_stations_title ON Stations(title);
