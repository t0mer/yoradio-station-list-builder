import sqlite3
from sqlite3 import Error
from loguru import logger

class SqliteConnector:
    def __init__(self):
        self.db_file = "db/stations.db"
        self.conn = None
        
    def open_connection(self):
        try:
            self.conn = sqlite3.connect(self.db_file)
        except Error as e:
            logger.error(str(e))

    def close_connection(self):
        try:
            self.conn.close()
        except Error as e:
            logger.error(str(e))

    def create_tables(self):
        logger.info('#')
        self.open_connection()

    def create_tables(self):
        logger.info('#')
        self.open_connection()
        create_countries_table = """ CREATE TABLE IF NOT EXISTS Countries (
                                id INTEGER PRIMARY KEY,
                                name TEXT NOT NULL UNIQUE); """

        create_stations_table = """ CREATE TABLE IF NOT EXISTS Stations (
                                        id TEXT PRIMARY KEY,
                                        title TEXT NOT NULL,
                                        final_url TEXT NOT NULL,
                                        country_id INTEGER,
                                        FOREIGN KEY (country_id) REFERENCES Countries(id)); """
        try:
            c = self.conn.cursor()
            c.execute(create_countries_table) 
            c.execute(create_stations_table)
            c.close()
            self.conn.close()          
        except Error as e:
            logger.error(str(e))
            
    def get_stations(self, api_call=False):
        stations = []
        logger.debug("api_call = " + str(api_call))
        try:
            self.open_connection()
            cursor = self.conn.cursor()
            query = """
                    SELECT Stations.id, Stations.title, Stations.final_url, Stations.country_id, Countries.name as country
                    FROM Stations  
                    JOIN Countries ON Stations.country_id = Countries.id"""
            cursor.execute(query)
            if api_call == True:
                rows = [dict((cursor.description[i][0], value) \
                for i, value in enumerate(row)) for row in cursor.fetchall()]
                cursor.close()
                return (rows[0] if rows else None) if False else rows
            else:
                rows = cursor.fetchall()
            return rows
        except Error as e:
            logger.error(str(e))
            return stations
        finally:
            self.close_connection()
            
    def get_countries(self, api_call=False):
        stations = []
        logger.debug("api_call = " + str(api_call))
        try:
            self.open_connection()
            cursor = self.conn.cursor()
            query = """select name, id from countries order by name"""
            cursor.execute(query)
            if api_call == True:
                rows = [dict((cursor.description[i][0], value) \
                for i, value in enumerate(row)) for row in cursor.fetchall()]
                cursor.close()
                return (rows[0] if rows else None) if False else rows
            else:
                rows = cursor.fetchall()
            return rows
        except Error as e:
            logger.error(str(e))
            return stations
        finally:
            self.close_connection()
            
    def get_country_by_id(self, country_id, api_call=False):
        stations = []
        logger.debug("api_call = " + str(api_call))
        try:
            self.open_connection()
            cursor = self.conn.cursor()
            query = "select name, id from countries where id=?"
            cursor.execute(query, (country_id,))
            if api_call == True:
                rows = [dict((cursor.description[i][0], value) \
                for i, value in enumerate(row)) for row in cursor.fetchall()]
                cursor.close()
                return (rows[0] if rows else None) if False else rows
            else:
                rows = cursor.fetchall()
            return rows
        except Error as e:
            logger.error(str(e))
            return stations
        finally:
            self.close_connection()


    def search_station(self, name, api_call=False):
        stations = []
        logger.debug(f"Name: {name}")
        logger.debug("api_call = " + str(api_call))
        try:
            self.open_connection()
            cursor = self.conn.cursor()
            query = """
        SELECT Stations.id, Stations.title, Stations.final_url, Stations.country_id, Countries.name as country
        FROM Stations
        JOIN Countries ON Stations.country_id = Countries.id
        WHERE Stations.title LIKE ?
        """
            cursor.execute(query, (f"%{name}%",))
            if api_call == True:
                rows = [dict((cursor.description[i][0], value) \
                for i, value in enumerate(row)) for row in cursor.fetchall()]
                cursor.close()
                return (rows[0] if rows else None) if False else rows
            else:
                rows = cursor.fetchall()
            return rows
        except Error as e:
            logger.error(str(e))
            return stations
        finally:
            self.close_connection()

    def get_stations_by_country_id(self, country_id, api_call=False):
        stations = []
        logger.debug("api_call = " + str(api_call))
        try:
            self.open_connection()
            cursor = self.conn.cursor()
            query = """
                    SELECT Stations.id, Stations.title, Stations.final_url, Stations.country_id, Countries.name as country
                    FROM Stations
                    JOIN Countries ON Stations.country_id = Countries.id
                    WHERE Stations.country_id = ?"""
            cursor.execute(query, (country_id,))
            if api_call == True:
                rows = [dict((cursor.description[i][0], value) \
                for i, value in enumerate(row)) for row in cursor.fetchall()]
                cursor.close()
                return (rows[0] if rows else None) if False else rows
            else:
                rows = cursor.fetchall()
            return rows
        except Error as e:
            logger.error(str(e))
            return stations
        finally:
            self.close_connection()

    def get_countries_count(self):
        try:
            self.open_connection()
            cursor = self.conn.cursor()
            query = f"""
                    SELECT count(id) from countries"""
            cursor.execute(query)
            result = cursor.fetchone()
            return result[0]
        except Error as e:
            logger.error(str(e))
            return 0
        finally:
            self.close_connection()        
            
    def get_stations_count(self):
        try:
            self.open_connection()
            cursor = self.conn.cursor()
            cursor.execute("SELECT count(id) from stations")
            result = cursor.fetchone()
            return result[0]
        except Error as e:
            logger.error(str(e))
            return 0
        finally:
            self.close_connection()

    def get_stations_paginated(self, country_id, search, start, length):
        try:
            self.open_connection()
            cursor = self.conn.cursor()

            base = """
                FROM Stations
                JOIN Countries ON Stations.country_id = Countries.id
            """
            params = []

            if country_id and int(country_id) != 0:
                base += " WHERE Stations.country_id = ?"
                params.append(int(country_id))
                if search:
                    base += " AND Stations.title LIKE ?"
                    params.append(f"%{search}%")
            elif search:
                base += " WHERE Stations.title LIKE ?"
                params.append(f"%{search}%")

            cursor.execute(f"SELECT COUNT(*) {base}", params)
            total_filtered = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM Stations")
            total = cursor.fetchone()[0]

            cursor.execute(
                f"SELECT Stations.id, Stations.title, Stations.final_url, Stations.country_id, Countries.name as country {base} LIMIT ? OFFSET ?",
                params + [length, start],
            )
            rows = [
                dict((cursor.description[i][0], value) for i, value in enumerate(row))
                for row in cursor.fetchall()
            ]
            return rows, total, total_filtered
        except Error as e:
            logger.error(str(e))
            return [], 0, 0
        finally:
            self.close_connection()

