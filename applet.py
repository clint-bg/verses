import streamlit as st
import pandas as pd
import numpy as np
import altair as alt

st.title('verses')
st.markdown('Pick a scripture verse and see that other scriptures are similar to it.')

# Load data
@st.cache
def load_data():
    return pd.read_csv('data/scriptures_sub.csv')

data = load_data()

# Sidebar
st.sidebar.title('Settings')
st.sidebar.markdown('Select a scripture to compare with others.')
book = st.sidebar.selectbox('Book', data['book_title'].unique())
# Filter dataframe based on selected country
f1_df = data[data["book_title"] == book]
chapter = st.sidebar.selectbox('Chapter', filtered_df['chapter_id'].unique())
f2_df = f1_df[f1_df["chapter_id"] == chapter]
verse = st.sidebar.selectbox('Verse', f2_df['verse_id'].unique())
st.write(f'You selected {book} {chapter}:{verse}')


c = (
   alt.Chart(data)
   .mark_circle()
   .encode(x="tsne_x", y="tsne_y", text='verse_short_title', color="cluster")
)

st.altair_chart(c, use_container_width=True)