import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from starlette import status
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates
from uvicorn import Config, Server

from handlers.fetcher import Handler
from handlers.model import CampusParams, CourseParams, UiTMRefuseException, UiTMCampusNotValid

templates = Jinja2Templates(directory="templates")


class Web(FastAPI):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.handler = Handler()
        self.loop = self.handler.loop


app = Web()
app.mount(
    "/static",
    StaticFiles(directory=Path(__file__).parent.absolute() / "static"),
    name="static",
)


@app.get('/api/campuses')
async def get_campus_list():
    return await app.handler.get_campus_list()


@app.post('/api/courses')
async def get_campus_courses(campus: CampusParams):
    try:
        return await app.handler.get_campus_courses(campus.branch)
    except UiTMCampusNotValid:
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch {branch!r} not found.".format(**dict(campus))
        )


@app.post('/api/course')
async def get_course(params: CourseParams):
    try:
        return await app.handler.get_course(params.branch, params.course)
    except UiTMCampusNotValid:
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course {course!r} with Branch {branch!r} not found.".format(**dict(params))
        )


@app.get("/")
@app.get("/index")
async def serve_branch(request: Request):
    if not (list_branches := await app.handler.get_campus_list()):
        app.handler.dispatch_error(serve_branch, Exception("No campus lists."))

    payload = {
        "request": request,
        "branches": json.dumps(list_branches)
    }
    return templates.TemplateResponse("index.html", payload)


@app.exception_handler(UiTMRefuseException)
async def refuse_handler(_: Request, __: UiTMRefuseException):
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "message": "UiTM is refusing to connect. Please try again."
        }
    )


@app.get("/about")
async def serve_about(request: Request):
    return templates.TemplateResponse("about.html", {"request": request})


def blocking_main():
    config = Config(app=app, loop=app.loop)
    server = Server(config=config)
    app.loop.run_until_complete(server.serve())


if __name__ == "__main__":
    blocking_main()
