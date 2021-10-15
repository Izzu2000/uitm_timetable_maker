class Class{
    constructor(courseName, day, start, end){
        this.courseName = courseName;
        this.day = day;
        this.start = start;
        this.end = end;
    }
}

class Group{
    constructor(course){
        this.course = course;
        this.groupValues = course.selectedGroupValues();
        this.toDate = this.toDate.bind(this);
        this.formatData = this.formatData.bind(this);
        this.classes = this.groupValues.map(this.formatData);
    }
    getAllHours(){
        return this.classes.map(e => {
            let end = e.end;
            return end.getHours() + (end.getMinutes() > 0);
        });
    }
    maxHour(){
        return Math.max(...this.getAllHours());
    }
    minHour(){
        return Math.min(...this.getAllHours());
    }
    hasWeekend(){
        return this.classes.map(e => e.day.toLowerCase()).includes("saturday", "sunday");
    }

    formatData(one_class){
        let start = this.toDate(one_class["Start"]);
        console.log("Start " + start);
        let end = this.toDate(one_class["End"]);
        console.log("End " + end);
        let [newStart, newEnd] = this.inferenceTime(start, end);
        console.log("newStart " + newStart);
        console.log("newEnd " + newEnd);
        return new Class(this.course.courseValue(), one_class['Day'], newStart, newEnd);
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
        return date;
    }
    inferenceTime(start, end){
        /*
        Another problem encountered with time is that, some class actually do goes above 6pm
        so we need both start and end time to inference correctly.
        
        Example inference
        4pm - 9am -> 4pm - 9pm
        */
        let startHour = start.getHours();
        let endHour = end.getHours();
        if (startHour > endHour){
            if (startHour == 0)
                start.setHours(12);
            else
                end.setHours(endHour + 12);
            
        }else if (startHour == 18 && endHour < 18){
            endHour.setHours(endHour + 12);
        }else if (startHour == endHour){
            throw new Error('Unable to inference time correctly');
        }
        return [start, end];
    }
}