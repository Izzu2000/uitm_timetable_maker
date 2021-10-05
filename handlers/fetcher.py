from __future__ import annotations
import itertools
import json
import operator
import sys
import traceback

import aiohttp
import asyncio
import re
from urllib.parse import quote
from typing import Any

import asyncpg
from aiohttp import ClientConnectionError

from config import SERVER_SETTING_PATH
from handlers.model import Course, UiTMRefuseException


class Route:
    BASE = "https://icress.uitm.edu.my"

    def __init__(self, method: str, path: str, **params: Any):
        self.path = path
        self.method = method
        url = self.BASE + self.path

        self.url = self.init_url(url, params)

    def init_url(self, url, params):
        def param_formatter(value):
            return quote(value) if isinstance(value, str) else value

        if params:
            return url.format(**{k: param_formatter(v) for k, v in params.items()})
        return url


class HTTPClient:
    def __init__(self, loop):
        self.loop = loop
        self.session = None  # ClientSession should be init in a coroutine

    async def request(self, route: Route, **kwargs):
        return await self.retry_request(route, retry=2, timeout=10, **kwargs)

    async def retry_request(self, route: Route, *, retry=1, **kwargs):
        assert retry > 0
        error = None
        while retry:
            try:
                return await self.handle_request(route, **kwargs)
            except Exception as e:
                error = e
                if isinstance(e, UiTMRefuseException):
                    print("uitm failure to connect, retrying...", flush=True)
                else:
                    print(f"Failure to perform request {route.method}: {route.url}")
                retry -= 1
        raise error

    async def handle_request(self, route: Route, **kwargs):
        if not self.session:
            self.session = aiohttp.ClientSession()

        try:
            async with self.session.request(route.method, route.url, **kwargs) as request:
                return await request.text(encoding='utf-8')
        except ClientConnectionError:
            raise UiTMRefuseException()

    def get_campus_list(self):
        return self.request(Route('GET', '/jadual/jadual/jadual.asp'))

    def get_schedule(self, campus: str):
        payload = {
            "select": campus,
            "Submit": "Submit"  # lol their button apparently for POST
        }
        return self.request(Route('POST', '/jadual/jadual/jadual.asp'), data=payload)

    def get_course(self, branch: str, course: str):
        return self.request(Route('GET', '/jadual/{branch}/{course}.html', branch=branch, course=course))


class Handler:
    CAMPUS_REGEX = re.compile(r'<option value="(?P<value>.*)"[ ]+>(?P<key>.*)</option>', flags=re.I)
    CAMPUS_FRAME = re.compile(r'<iframe[ ]+border=0[ ]+name=satu[ ]+src="[.]+/(?P<branch>.*)/(?P<course>.*).html"', flags=re.I)
    CAMPUS_COURSE = re.compile(r'<a[ ]+href[ ]*=[ ]*"[.]+\\(?P<branch>.*)\\(?P<course>.*)\.html"[ ]*target[ ]*=[ ]*".*">(?P<name>.*)</a><BR>', flags=re.I)
    ROWS = re.compile(r'<tr>((\n|.)*?)</tr>', flags=re.I)
    COLUMNS = re.compile(r'<td>((\n|.)*?)</td>', flags=re.I)

    def __init__(self):
        self.loop = asyncio.get_event_loop()
        self.http = HTTPClient(self.loop)
        self.pool = None
        self.loop.create_task(self.create_pool())

    async def create_pool(self):
        with open(SERVER_SETTING_PATH) as r:
            settings = json.load(r)

        self.pool = await asyncpg.create_pool(user=settings["database_username"], database=settings["database_name"], password=["database_password"])

    async def fetch_campus_list(self):
        raw_data = await self.http.get_campus_list()
        # Since raw_data is pretty much a text response, we need to use regex here
        get_value = operator.itemgetter('value')
        return [*map(get_value, re.finditer(self.CAMPUS_REGEX, raw_data))]

    async def fetch_campus_courses(self, campus: str):
        raw_data = await self.http.get_schedule(campus)
        data = self.CAMPUS_FRAME.search(raw_data)
        # This post request returns the html itself, and reference to a iframe tag, we get them
        frame_data = await self.http.get_course(data['branch'], data['course'])
        courses = {}
        for result in self.CAMPUS_COURSE.finditer(frame_data):
            courses.update({result['name']: Course.from_regex(result)})

        return courses

    def dispatch_error(self, callback, error):
        self.loop.create_task(self.on_error(callback, error))

    async def on_error(self, callback, error):
        print(f'Error while invoking {callback.__name__}:', file=sys.stderr, flush=True)
        traceback.print_exception(type(error), error, error.__traceback__)

    def tables(self, raw):
        getter = operator.itemgetter(0)  # cleaner
        rows = self.ROWS.findall(raw)
        for column, *_ in rows:
            yield [*map(getter, self.COLUMNS.findall(column))]

    async def fetch_course(self, campus: str, subject: str):
        subjects = await self.fetch_campus_courses(campus)
        found = subjects[subject]
        raw_schedule = await self.http.get_course(found.branch, found.course)
        iterator = self.tables(raw_schedule)
        header, *rows = list(iterator)
        header_iterator = itertools.cycle(header)

        def clean_value(value):
            return value\
                .replace('\r\n', ' ')\
                .strip()
        return [{next(header_iterator): clean_value(value) for value in row} for row in rows]
