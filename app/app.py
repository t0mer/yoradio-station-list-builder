import uvicorn
import requests
from loguru import logger
from sqliteconnector import SqliteConnector
from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette_exporter import PrometheusMiddleware, handle_metrics


connector = SqliteConnector()
connector.create_tables()

app = FastAPI(
    title="YoRadio stations list creator",
    description="Create your own stations list the easy way",
    version="1.0.0",
    contact={"name": "Tomer Klein", "email": "tomer.klein@gmail.com", "url": "https://github.com/t0mer/yoradio-station-list-builder"},
)

app.mount("/dist", StaticFiles(directory="dist"), name="dist")
app.mount("/plugins", StaticFiles(directory="plugins"), name="plugins")

templates = Jinja2Templates(directory="templates/")

app.add_middleware(PrometheusMiddleware)
app.add_route("/metrics", handle_metrics)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def index(request: Request):
    return templates.TemplateResponse("index.html", context={"request": request})


@app.get("/api/stations", summary="Get list of stations")
def get_stations(request: Request):
    try:
        return JSONResponse(connector.get_stations(True))
    except Exception as e:
        logger.error("Error fetching stations: " + str(e))
        return None


@app.get("/api/stations/datatable", summary="Server-side paginated stations for DataTables")
def get_stations_datatable(request: Request, draw: int = 1, start: int = 0, length: int = 10, search: str = "", country_id: int = 0):
    try:
        data, total, filtered = connector.get_stations_paginated(country_id, search, start, length)
        return JSONResponse({"draw": draw, "recordsTotal": total, "recordsFiltered": filtered, "data": data})
    except Exception as e:
        logger.error("Error fetching paginated stations: " + str(e))
        return JSONResponse({"draw": draw, "recordsTotal": 0, "recordsFiltered": 0, "data": []})


@app.get("/api/stations/{country_id}", summary="Get list of stations by country")
def get_stations_by_id(request: Request, country_id: int):
    try:
        return JSONResponse(connector.get_stations_by_country_id(country_id, True))
    except Exception as e:
        logger.error("Error fetching stations by country: " + str(e))
        return None


@app.get("/api/countries", summary="Get list of countries")
def get_countries(request: Request):
    try:
        return JSONResponse(connector.get_countries(True))
    except Exception as e:
        logger.error("Error fetching countries: " + str(e))
        return None


@app.get("/api/countries/{country_id}", summary="Get country by id")
def get_country_by_id(request: Request, country_id: int):
    try:
        return JSONResponse(connector.get_country_by_id(country_id, True))
    except Exception as e:
        logger.error("Error fetching country: " + str(e))
        return None


@app.get("/api/count/countries", summary="Get total countries count")
def get_num_of_countries(request: Request):
    try:
        return JSONResponse({"status": "ok", "count": connector.get_countries_count()})
    except Exception as e:
        logger.error("Error fetching countries count: " + str(e))
        return None


@app.get("/api/count/stations", summary="Get total stations count")
def get_num_of_stations(request: Request):
    try:
        return JSONResponse({"status": "ok", "count": connector.get_stations_count()})
    except Exception as e:
        logger.error("Error fetching stations count: " + str(e))
        return None


@app.get("/api/search/station", summary="Search stations by name")
def search_station(request: Request, name: str):
    try:
        return JSONResponse(connector.search_station(name, True))
    except Exception as e:
        logger.error("Error searching stations: " + str(e))
        return None


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8082)
