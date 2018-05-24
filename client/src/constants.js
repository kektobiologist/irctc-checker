import React, { Component } from "react";

export const menuStyle = {
  borderRadius: "3px",
  boxShadow: "0 2px 12px rgba(0, 0, 0, 0.1)",
  background: "rgba(255, 255, 255, 0.9)",
  padding: "2px 0",
  fontSize: "90%",
  position: "fixed",
  overflow: "auto",
  maxHeight: "50%", // TODO: don't cheat, let it flow to the bottom
  zIndex: 100
};

export const classes = ["1A", "2A", "3A", "SL", "2S", "EC", "CC"];

const timeToNum = str => {
  var a, b;
  [a, b] = str.split(":");
  return parseInt(a) * 100 + parseInt(b);
};
const timeSort = (a, b, order) => {
  var val = timeToNum(a) - timeToNum(b);
  if (order === "asc") return val;
  return -val;
};

export const columns = [
  {
    dataField: "trainNo",
    text: "Train No"
  },
  {
    dataField: "trainName",
    text: "Train Name"
  },
  {
    dataField: "classc",
    text: "Class",
    sort: true
  },
  {
    dataField: "availablityStatus",
    text: "Availability",
    formatter: (cell, row) => {
      const colors = {
        "1": "text-success",
        "2": "text-warning",
        "3": "text-warning"
      };
      var color = colors[row.availablityType] || "text-secondary";
      return <p className={color}>{cell}</p>;
    },
    sort: true
  },
  {
    dataField: "departureTime",
    text: "Departure Time",
    sort: true,
    sortFunc: timeSort
  },
  {
    dataField: "arrivalTime",
    text: "Arrival Time",
    sort: true,
    sortFunc: timeSort
  },
  {
    dataField: "duration",
    text: "Duration",
    sort: true,
    sortFunc: timeSort
  },
  {
    dataField: "totalCollectibleAmount",
    text: "Fare (Rs.)",
    sort: true
  }
];
