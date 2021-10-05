import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from starlette import status
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates

from handlers.fetcher import Handler
from handlers.model import CampusParams, CourseParams, UiTMRefuseException

templates = Jinja2Templates(directory="templates")


class Web(FastAPI):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.handler = Handler()


app = Web()
app.mount(
    "/static",
    StaticFiles(directory=Path(__file__).parent.parent.absolute() / "static"),
    name="static",
)


@app.get('/api/campuses')
async def get_campus_list():
    return await app.handler.fetch_campus_list()


@app.post('/api/courses')
async def get_campus_subjects(campus: CampusParams):
    return await app.handler.fetch_campus_courses(campus.branch)


@app.post('/api/course')
async def get_subject(params: CourseParams):
    try:
        return await app.handler.fetch_course(params.branch, params.course)
    except KeyError:
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course {course!r} with Branch {branch!r} not found.".format(**dict(params))
        )


@app.get("/")
@app.get("/index")
async def serve_branch(request: Request):
    if not (list_branches := await app.handler.fetch_campus_list()):
        app.handler.dispatch_error(Exception("No campus lists."))

    payload = {
        "request": request,
        "branches": json.dumps(list_branches)
    }
    return templates.TemplateResponse("index.html", payload)


@app.exception_handler(UiTMRefuseException)
async def refuse_handler(request: Request, exc: UiTMRefuseException):
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "message": "UiTM is refusing to connect. Please try again."
        }
    )


@app.get("/about")
async def serve_about(request: Request):
    return templates.TemplateResponse("about.html", {"request": request})