import React, { Component } from "react";
import AutosuggestX from "react-autosuggest";

var Autosuggest = ({ suggestions, value, onChange, placeholder }) => (
  <AutosuggestX
    suggestions={suggestions}
    getSuggestionValue={suggestion => suggestion}
    renderSuggestion={suggestion => <div>{suggestion}</div>}
    onSuggestionsFetchRequested={() => {}}
    onSuggestionsClearRequested={() => {}}
    shouldRenderSuggestions={() => true}
    onSuggestionSelected={(e, { suggestionValue }) => onChange(suggestionValue)}
    inputProps={{
      value,
      onChange: (e, { newValue }) => onChange(newValue),
      placeholder
    }}
    theme={{
      container: "react-autosuggest__container",
      containerOpen: "react-autosuggest__container--open",
      input: "form-control",
      inputOpen: "react-autosuggest__input--open",
      inputFocused: "react-autosuggest__input--focused",
      suggestionsContainer: "react-autosuggest__suggestions-container",
      suggestionsContainerOpen:
        "react-autosuggest__suggestions-container--open",
      suggestionsList: "react-autosuggest__suggestions-list",
      suggestion: "react-autosuggest__suggestion",
      suggestionFirst: "react-autosuggest__suggestion--first",
      suggestionHighlighted: "react-autosuggest__suggestion--highlighted",
      sectionContainer: "react-autosuggest__section-container",
      sectionContainerFirst: "react-autosuggest__section-container--first",
      sectionTitle: "react-autosuggest__section-title"
    }}
  />
);

export default Autosuggest;
