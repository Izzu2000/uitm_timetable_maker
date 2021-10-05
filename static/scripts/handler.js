var pageState = {
    "rows": [], 
    "courses": [], 
    "groups": {},
    "group_selection": new Set()
};
function currentCourses(){
    return pageState["rows"].filter(e => e.initiated);
}
function selectedBranch(branch){
    pageState["courses"] = [];
    pageState["groups"] = {};
    if ("table" in pageState){
        currentCourses().forEach(e => e.updateBranch(branch));
        return;
    }else{
        pageState["table"] = createTable();
    }
    let course = createNewCourse(branch);
    course.initiateCourse();
}
function createNewCourse(branch){
    var table = pageState["table"];
    let course = new Course(branch, table);
    pageState["rows"].push(course);
    course.createRow();
    return course;
}
class BasicAccumulator{
    constructor(){
        this.functions = [];
        this.functionLock = false;
        this.executor = this.executor.bind(this);
        this.execute = this.execute.bind(this);
    }
    execute(callback){
        this.functions.push(callback);
        if (!this.functionLock)
            this.executor();
    }
    async executor(){
        this.functionLock = true;
        while(this.functions.length){
            var thisCallback = this.functions.pop();
            await thisCallback();
        }
        this.functionLock = false;
    }

}
var accumulator = new BasicAccumulator();
class Course {
    constructor(branch, table) {
        this.selectedGroupValues = this.selectedGroupValues.bind(this);
        this.groupValue = this.groupValue.bind(this);
        this.courseValue = this.courseValue.bind(this);
        this.selectedGroup = this.selectedGroup.bind(this);
        this.branch = branch;
        this.table = table;
        this.rowCourse = table.insertRow();
        this.groupSpinner = null;
        this.courseSpinner = null;
        this.selectedCourse = this.selectedCourse.bind(this);
        this.deleteCourse = this.deleteCourse.bind(this);
        this.attachRow = this.attachRow.bind(this);
        this.updateBranch = this.updateBranch.bind(this);
        this.initSpinners = this.initSpinners.bind(this);
        this.initDelete = this.initDelete.bind(this);
        this.initiateCourse = this.initiateCourse.bind(this);
        this.fillCourses = this.fillCourses.bind(this);
        this.fillGroups = this.fillGroups.bind(this);
        this.autoGroupAssume = this.autoGroupAssume.bind(this);
        this.__getCourses = this.__getCourses.bind(this);
        this.lock = false;
        this.isInit = false;
        this.selectionData = [];
    }
    selectedGroupValues(){
        var value = this.groupValue();
        return this.selectionData.filter(e => e["Group"] == value);
    }
    updateBranch(branch){
        this.branch = branch;
        this.groupSpinner.clearOptions();
        this.getCourses();
    }

    get initiated(){
        return this.isInit;
    }
    initiateCourse(){
        this.isInit = true;
        this.groupSpinner.fullInitSpinner();
        this.initSpinners();
        createNewCourse(this.branch);
        this.courseSpinner.removeClickListener(this.initiateCourse);
    }
    createRow(){
        let row = this.rowCourse;

        let firstCell = row.insertCell();
        let secondCell = row.insertCell();

        this.courseSpinner = new PartialSpinner("Select Course", "Add Course", firstCell);
        this.courseSpinner.setClickListener(this.initiateCourse);
        this.courseSpinner.addSelectedListener(this.selectedCourse);
        this.groupSpinner = new PartialSpinner("Select Group", "-", secondCell);
        this.groupSpinner.addSelectedListener(this.selectedGroup);

        this.table.appendChild(row);
    }
    initDelete(){
        let delButton = document.createElement("button");
        delButton.innerHTML = "Delete";
        delButton.setAttribute("class", "btn btn-outline-danger");
        delButton.setAttribute("type", "button");
        delButton.onclick = this.deleteCourse;
        this.attachRow(delButton);
    }
    attachRow(node){
        let delCell = this.rowCourse.insertCell();
        delCell.appendChild(node);
    }
    deleteCourse(){
        let arr = pageState["rows"];
        let index = arr.indexOf(this);
        if (index > -1)
            arr.splice(index, 1);
        this.table.removeChild(this.rowCourse);
        creator.renderTable();
    }
    fillCourses(data){
        for (var key in data)
                createOptionJson(this.courseSpinner, data[key]);
    }
    getCourses(){
        accumulator.execute(this.__getCourses);
    }
    async __getCourses(){
        this.courseSpinner.clearOptions();
        var cachedCourses = pageState["courses"];
        if (cachedCourses.length != 0){
            this.fillCourses(cachedCourses);
            return;
        }

        let payload = {branch: this.branch}
        let response = await fetch("/api/courses", {
            method: "POST",
            body: JSON.stringify(payload),
            headers: {'Content-Type': 'application/json'}
        });
        let json = await response.json();
        for(var key in json)
            cachedCourses.push(json[key]);
        this.fillCourses(json);
    }
    courseValue(){
        return this.courseSpinner.value;
    }
    groupValue(){
        return this.groupSpinner.value;
    }
    fillGroups(data){
        let filled = [];
        for(var key in data){
            let rawData = data[key];
            let value = rawData["Group"];
            if (!filled.includes(value)){
                filled.push(value);
                createOption(this.groupSpinner, value, value);
            }
            this.selectionData.push(rawData);
        }
        this.autoGroupAssume();
    }
    autoGroupAssume(){
        let prevSelections = pageState["group_selection"];
        
        for(var i = 0; i < this.selectionData.length; i++){
            let group = this.selectionData[i]["Group"];
            if (prevSelections.has(group)){
                this.selectedGroup(group);
                break;
            }
        }
    }

    selectedCourse(value){
        let select = this.groupSpinner;
        select.clearOptions();
        this.selectionData = [];

        let cachedGroups = pageState["groups"][value];
        if(cachedGroups !== undefined && cachedGroups.length != 0){
            this.fillGroups(cachedGroups);
            return;
        }
        pageState["groups"][value] = []


        let payload = {
            branch: this.branch,
            course: value
        }
        fetch("/api/course", {
          method: "POST",
          body: JSON.stringify(payload),
          headers: {
            'Content-Type': 'application/json'
            }
        }).then(res => res.json())
        .then(json => {
            for(var key in json)
                pageState["groups"][value].push(json[key]);
            this.fillGroups(json);
        });
    }
    selectedGroup(val){
        this.groupSpinner.setValue(val);
        pageState["group_selection"].add(val);
        creator.renderTable();
    }
    initSpinners(){
        this.initDelete();
        this.getCourses();
    }
    createSelect(callback){
        var selectList = document.createElement("select");
        selectList.setAttribute('class', 'js-example-basic-single');
        selectList.onclick = callback;

        this.attachRow(selectList);
        return selectList;
    }

}

class TimeTableCreator{
    constructor(){
        this.rows = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday"
        ]
        this.renderTable = this.renderTable.bind(this);
    }
    renderTable(){
        var timetable = new Timetable();
        timetable.setScope(8, 18);
        timetable.addLocations(this.rows);
        var alreadyFilled = new Set();
        pageState["rows"].forEach(course => {
            let courseName = course.courseValue();
            if (!alreadyFilled.has(courseName)){
                alreadyFilled.add(courseName);
                /* The reason we do this is to avoid duplicate data being rendered.
                    It is much easier to do this than disallowing user for adding the same
                    course. Nobody got time for that.
                */
                let rawData = course.selectedGroupValues();
                rawData.forEach(classes => {
                    let start = this.toDate(classes["Start"]);
                    console.log("Start " + start);
                    let end = this.toDate(classes["End"]);
                    console.log("End " + end);
                    timetable.addEvent(courseName, classes['Day'], start, end);
                });
            }
        });
        var renderer = new Timetable.Renderer(timetable);
        renderer.draw('.timetable');
    }
    toDate(time){
        /*
        The problem with uitm time given is that, they are unreliable
        They use both 24 and 12 hour time, which is confusing
        Possibility of data would be
            13:00pm (would break the regular date parse)
            12:00am (referring to 12:00pm, there are no classes at 12 midnight lol)
        With this in mind, the function is to:
            - convert 12 to 12:00 regardless of pm/am
            - convert 1pm or 1am to 13:00 (not logical for classes to be at night)

            if hour 1 - 6, they would be 13 - 18
            if hour 8 - 12 or 0, they would be 8 - 12

        I wasn't sure to do this client side or server side, i decided to do it in client side
        because it's the client responsibility to interpret this data.
        */
        var grouper = /^((?<hour>[01]?[0-9]|2[0-3])):(?<min>(([0-5]\d)(:[0-5]\d)?))( )*(?<day>(am|pm))$/.exec(time);
        const {groups: {hour, min, day}} = grouper;
        var date = new Date();
        var currentHour = parseInt(hour);
        var currentMinute = parseInt(min);
        if (currentHour <= 6 && currentHour > 0)
            currentHour += 12;
        else if (currentHour == 0)
            currentHour = 12;

        date.setHours(currentHour);
        date.setMinutes(currentMinute);
        date.setSeconds(0);
        console.log(currentHour);
        console.log(date);
        return date;
    }
}
var creator = new TimeTableCreator();
function createOptionJson(spinner, subj){
    return createOption(spinner, subj['course'], subj['name']);
}
function createOption(spinner, value, text){
    spinner.addOption(value, text)
}

function createTH(row, text){
    var thCell = document.createElement("TH");
    thCell.innerHTML = text;
    thCell.scope = "col";
    row.appendChild(thCell);
}
function createHeader(table){
    let headerTH = table.createTHead();
    let header = headerTH.insertRow();
    createTH(header, "Course");
    createTH(header, "Group");
    createTH(header, "");
}
function createTable(){
    let table = document.getElementById("table_selection");
    table.setAttribute('class', 'table table-striped');
    createHeader(table);
    return table;
}
