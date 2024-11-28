import streamlit as st
import pandas as pd
import numpy as np
import altair as alt

st.title('versus')
st.markdown('Pick a scripture and see that other scriptures are similar to it.')

# Load data
@st.cache
def load_data():
    return pd.read_csv('data/verses.csv')

data = load_data()

# Sidebar
st.sidebar.title('Settings')
st.sidebar.markdown('Select a scripture to compare with others.')
verse = st.sidebar.selectbox('Verse', data['verse'])


c = (
   alt.Chart(data)
   .mark_circle()
   .encode(x="tsne_x", y="tsne_y", color="cluster")
)

st.altair_chart(c, use_container_width=True)