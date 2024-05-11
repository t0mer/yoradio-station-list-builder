import uvicorn
import requests
from loguru import logger
from sqliteconnector import SqliteConnector
from fastapi import FastAPI, Request, File, Form, UploadFile
from fastapi.responses import UJSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from starlette.responses import FileResponse
from starlette.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from starlette_exporter import PrometheusMiddleware, handle_metrics




class Server:
    def __init__(self):
        self.connector = SqliteConnector()
        self.connector.create_tables()


        self.app = FastAPI(title="YoRadio stations list creator", description="Create you own stations list the easy way", version='1.0.0',  contact={"name": "Tomer Klein", "email": "tomer.klein@gmail.com", "url": "https://github.com/t0mer/yoradio-station-list-builder"})
        self.app.mount("/dist", StaticFiles(directory="dist"), name="dist")
        self.app.mount("/plugins", StaticFiles(directory="plugins"), name="plugins")
        self.app.mount("/js", StaticFiles(directory="dist/js"), name="js")
        self.app.mount("/css", StaticFiles(directory="dist/css"), name="css")
        self.templates = Jinja2Templates(directory="templates/")
        self.app.add_middleware(PrometheusMiddleware)
        self.app.add_route("/metrics", handle_metrics)
        self.origins = ["*"]

        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=self.origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        
        
        @self.app.get("/api/stations", summary="Get list of stations")
        def get_stations(request: Request):
            """
            Get the list of stationsS
            """
            try:
                response = self.connector.get_stations(True)
                return JSONResponse(response)
            except Exception as e:
                logger.error("Error fetch images, " + str(e))
                return None       
        
        @self.app.get("/api/stations/{country_id}", summary="Get list of stations")
        def get_stations_by_id(request: Request,country_id:int):
            """
            Get the list of stationsS
            """
            try:
                response = self.connector.get_stations_by_country_id(country_id,True)
                return JSONResponse(response)
            except Exception as e:
                logger.error("Error fetch images, " + str(e))
                return None       
        
        @self.app.get("/api/count/countries", summary="Get list of stations")
        def get_num_of_countries(request: Request):
            """
            Get the list of stations
            """
            try:
                response = self.connector.get_countries_count()
                return JSONResponse({"status":"ok","count":response})
            except Exception as e:
                logger.error("Error fetch images, " + str(e))
                return None       
        

        @self.app.get("/api/count/stations", summary="Get list of stations")
        def get_num_of_stations(request: Request):
            """
            Get the list of stationsS
            """
            try:
                response = self.connector.get_stations_count()
                return JSONResponse({"status":"ok","count":response})
            except Exception as e:
                logger.error("Error fetch images, " + str(e))
                return None       
        

          
        
        
        
        
    def start(self):
        uvicorn.run(self.app, host="0.0.0.0", port=8082)
        
        
if __name__=="__main__":
    server = Server()
    server.start()