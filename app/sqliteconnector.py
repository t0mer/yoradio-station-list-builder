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

    def get_stations_by_country_id(self, country_id, api_call=False):
        stations = []
        logger.debug("api_call = " + str(api_call))
        try:
            self.open_connection()
            cursor = self.conn.cursor()
            query = f"""
                    SELECT Stations.id, Stations.title, Stations.final_url, Stations.country_id, Countries.name as country
                    FROM Stations  
                    JOIN Countries ON Stations.country_id = Countries.id 
                    where Stations.country_id = {country_id}"""
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
            query = f"""
                    SELECT count(id) from stations"""
            cursor.execute(query)
            result = cursor.fetchone()
            return result[0]
        except Error as e:
            logger.error(str(e))
            return 0
        finally:
            self.close_connection()        
            
