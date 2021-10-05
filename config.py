import asyncio
import json
import pathlib

import click
from sqlalchemy.ext.asyncio import create_async_engine

from handlers.db import Base

SERVER_SETTING_PATH = "server_settings.json"


def retrieve_engine(*, user, password, database, host="127.0.0.1"):
    return create_async_engine(f"postgresql+asyncpg://{user}:{password}@{host}/{database}", echo=True)


async def db_creation(*, database_username, database_password, database_name, **kwargs):
    engine = retrieve_engine(user=database_username, password=database_password, database=database_name)
    meta = Base.metadata
    async with engine.begin() as conn:
        await conn.run_sync(meta.create_all)


async def db_drop(*, database_username, database_password, database_name, **kwargs):  # **kwargs cause lazy
    engine = retrieve_engine(user=database_username, password=database_password, database=database_name)
    meta = Base.metadata
    async with engine.begin() as conn:
        await conn.run_sync(meta.drop_all)


def db_wrap(settings, callback):
    """Create all the tables for the database.
       Note: This does not check if the database exists or not. You must drop all the tables related.
    """

    try:
        loop = asyncio.get_event_loop()
        loop.run_until_complete(callback(**settings))
    except Exception as e:
        raise e from None
    else:
        print("Finished creating database.")


@click.group(invoke_without_command=True)
@click.option('--create', help="Create all the necessary table required into the database.", is_flag=True)
@click.option('--drop', help="Drops all the necessary table in the database.", is_flag=True)
def init(create, drop):
    if create or drop:
        try:
            with open(SERVER_SETTING_PATH) as r:
                settings = json.load(r)
        except FileNotFoundError:
            raise Exception("server file not found. Make sure to run 'python config.py register-db' first.")
        if create:
            db_wrap(settings, db_creation)
        if drop:
            db_wrap(settings, db_drop)


@init.command(short_help="Creates a database settings file for the server to operate.")
@click.argument('database_name')
@click.argument('database_user')
@click.argument('database_password')
def register_db(database_name, database_user, database_password):
    """
    Creates a database settings file for the server to operate. This will be named as 'server_settings.json'

    Arguments; \n
    database_name: The database name that the user has access/created for.
    database_user: The database user that will be used.
    database_password: The database password that will be used for the user.

    Note: This will completely override files that are named as 'server_settings.json'.
    """
    path = pathlib.Path(SERVER_SETTING_PATH)
    settings = {
        "database_name": database_name,
        "database_username": database_user,
        "database_password": database_password
    }
    with open(path, "w+") as fp:
        json.dump(settings, fp, indent=4)
    click.echo(f"Successfully created a server settings file at {path}")

    settings_created = "\n  ".join(f"{k}: '{v}'" for k, v in settings.items())
    content = f"Settings:\n {settings_created}"
    click.echo(content)


@init.command(short_help="Creates a host settings file for the server to be hosted.")
@click.argument('host_path')
@click.argument('host')
@click.argument('port')
def create_host(host_path, host, port):
    """
    Creates a host settings file for the server to be hosted. This will be named as 'server_settings.json'

    Arguments; \n
    host_path: File path that will generate a gunicorn python file
    host: The database name that the user has access/created for.
    port: The database user that will be used.

    Note: This will require 'server_settings.json' to exist first.
    """
    path = pathlib.Path(SERVER_SETTING_PATH)
    settings = {
        "host_path": host_path,
        "host": host,
        "port": port
    }
    try:
        with open(path) as r:
            setter = json.load(r)
            setter.update(settings)
    except FileNotFoundError:
        raise Exception(f"File '{path}' does not exist. Please run 'python config.py register-db first.'")
    with open(path, "w+") as fp:
        json.dump(setter, fp, indent=4)
    click.echo(f"Successfully added a server settings file at {path}")

    settings_created = "\n  ".join(f"{k}: '{v}'" for k, v in settings.items())
    content = f"Settings:\n {settings_created}"
    click.echo(content)


if __name__ == "__main__":
    init()