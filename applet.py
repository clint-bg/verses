import streamlit as st
import pandas as pd
import numpy as np
import altair as alt

st.title('verses')
st.markdown('Pick a scripture verse and see that other scriptures are similar to it.')

# Load data
@st.cache_data
def load_data():
    return pd.read_csv('data/scriptures_sub.csv')

data = load_data()

# Sidebar
st.sidebar.title('Settings')
st.sidebar.markdown('Select a scripture to compare with others.')
book = st.sidebar.selectbox('Book', data['book_title'].unique())
# Filter dataframe based on selected country
f1_df = data[data["book_title"] == book]
chapter = st.sidebar.selectbox('Chapter', f1_df['chapter_number'].unique())
f2_df = f1_df[f1_df["chapter_number"] == chapter]
verse = st.sidebar.selectbox('Verse', f2_df['verse_number'].unique())
st.write(f'You selected {book} {chapter}:{verse}')

#get data subset based on selected verse
row = f2_df[(f2_df['verse_number'] == verse)].iloc[0]
# distance from selected verse based on tsne_x and tsne_y
data['distance'] = np.sqrt((data['tsne_x'] - row['tsne_x'])**2 + (data['tsne_y'] - row['tsne_y'])**2)
# get top 10 similar verses
top50 = data.sort_values('distance').head(50)

allpoints = (
   alt.Chart(data)
   .mark_circle()
   .encode(
       alt.X("tsne_x", axis=None),
       alt.Y("tsne_y", axis=None),
       color=alt.Color("Origin", legend=None)).interactive()
)

points = (
    alt.Chart(top50)
    .mark_circle()
    .encode(
        alt.X("tsne_x",scale=alt.Scale(domain=[top50['tsne_x'].min(), top50['tsne_x'].max()])),
        alt.Y("tsne_y",scale=alt.Scale(domain=[top50['tsne_y'].min(), top50['tsne_y'].max()])),
        color="cluster",
        tooltip=['verse_short_title','cluster']).interactive()
)

chart = alt.vconcat(allpoints + points)

st.altair_chart(chart, use_container_width=True)

st.markdown('---')
for i in range(10):
    st.write(f'{top50['verse_short_title'].iloc[i]}: {top50['scripture_text'].iloc[i]}')
